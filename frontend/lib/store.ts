import { create } from 'zustand';

interface Task {
  id: string;
  prompt: string;
  repository: string;
  status: 'pending' | 'planning' | 'in-progress' | 'completed' | 'failed';
  createdAt: string;
}

interface TaskStore {
  tasks: Task[];
  currentTask: Task | null;
  setCurrentTask: (task: Task | null) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, task: Partial<Task>) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  currentTask: null,
  setCurrentTask: (task) => set({ currentTask: task }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
}));
