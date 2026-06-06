import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { executeTask } from './execution';
import { storage } from './storage';

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

// Middleware
app.use(cors());
app.use(express.json());

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

// Health check endpoint
app.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage: await storage.getMode(),
    });
  })
);

app.get(
  '/api/tasks',
  asyncHandler(async (req: Request, res: Response) => {
    const tasks = await storage.listTasks();
    res.json({ tasks });
  })
);

app.post(
  '/api/tasks',
  asyncHandler(async (req: Request, res: Response) => {
    const prompt = req.body.prompt;
    const repositoryUrl = req.body.repositoryUrl ?? req.body.repository;

    if (!isNonEmptyString(prompt) || !isNonEmptyString(repositoryUrl)) {
      res.status(400).json({
        error: 'Both prompt and repositoryUrl are required.',
      });
      return;
    }

    const task = await storage.createTask({
      prompt: prompt.trim(),
      repositoryUrl: repositoryUrl.trim(),
    });

    await storage.createExecutionLog({
      taskId: task.id,
      message: 'Task created and queued for execution.',
    });

    const hydratedTask = await storage.getTaskById(task.id);

    res.status(201).json({
      task: hydratedTask ?? task,
    });
  })
);

app.get(
  '/api/tasks/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const task = await storage.getTaskById(req.params.id);

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    res.json({ task });
  })
);

app.post(
  '/api/tasks/:id/execute',
  asyncHandler(async (req: Request, res: Response) => {
    const task = await executeTask(req.params.id);

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    res.json({ task });
  })
);

app.get(
  '/api/executions',
  asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.query.taskId;

    if (!isNonEmptyString(taskId)) {
      res.status(400).json({ error: 'taskId query parameter is required.' });
      return;
    }

    const executions = await storage.listExecutionsByTaskId(taskId);
    res.json({ executions });
  })
);

app.get(
  '/api/pull-requests',
  asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.query.taskId;

    if (!isNonEmptyString(taskId)) {
      res.status(400).json({ error: 'taskId query parameter is required.' });
      return;
    }

    const pullRequests = await storage.listPullRequestsByTaskId(taskId);
    res.json({ pullRequests });
  })
);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
