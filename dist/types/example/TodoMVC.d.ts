import Vue from 'vue';
export interface Todo {
    id: number;
    title: string;
    completed: boolean;
}
export declare const filters: {
    all: (todos: Todo[]) => Todo[];
    active: (todos: Todo[]) => Todo[];
    completed: (todos: Todo[]) => Todo[];
};
declare const TodoMVC: import("vue").VueConstructor<{
    todos: Todo[];
    newTodo: string;
    editedTodo: Todo | null;
    visibility: "all" | "active" | "completed";
    beforeEditCache: string;
} & {
    addTodo: () => void;
    removeTodo: (todo: Todo) => void;
    editTodo: (todo: Todo) => void;
    doneEdit: (todo: Todo) => void;
    cancelEdit: (todo: Todo) => void;
    removeCompleted: () => void;
} & {
    filteredTodos: Todo[];
    remaining: number;
    allDone: any;
} & Record<never, any> & Vue>;
export default TodoMVC;
