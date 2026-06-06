import { create } from 'zustand';
import { TaskDetails } from './api';

interface TaskStore {
  tasks: TaskDetails[];
  currentTask: TaskDetails | null;
  setTasks: (tasks: TaskDetails[]) => void;
  setCurrentTask: (task: TaskDetails | null) => void;
  addTask: (task: TaskDetails) => void;
  updateTask: (id: string, task: Partial<TaskDetails>) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  currentTask: null,
  setTasks: (tasks) => set({ tasks }),
  setCurrentTask: (task) => set({ currentTask: task }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)),
      currentTask:
        state.currentTask?.id === id
          ? { ...state.currentTask, ...updates }
          : state.currentTask,
    })),
}));
