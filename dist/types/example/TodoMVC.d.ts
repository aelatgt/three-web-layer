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
declare const TodoMVC: import("vue/types/vue").ExtendedVue<Vue, {
    todos: Todo[];
    newTodo: string;
    editedTodo: Todo;
    visibility: "all" | "active" | "completed";
    beforeEditCache: string;
}, {
    addTodo: () => void;
    removeTodo: (todo: Todo) => void;
    editTodo: (todo: Todo) => void;
    doneEdit: (todo: Todo) => void;
    cancelEdit: (todo: Todo) => void;
    removeCompleted: () => void;
}, {
    filteredTodos: Todo[];
    remaining: number;
    allDone: boolean;
}, Record<"$el" | "$options" | "$parent" | "$root" | "$children" | "$refs" | "$slots" | "$scopedSlots" | "$isServer" | "$data" | "$props" | "$ssrContext" | "$vnode" | "$attrs" | "$listeners" | "$mount" | "$forceUpdate" | "$destroy" | "$set" | "$delete" | "$watch" | "$on" | "$once" | "$off" | "$emit" | "$nextTick" | "$createElement", any>>;
export default TodoMVC;
