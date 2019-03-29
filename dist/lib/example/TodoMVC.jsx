"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vue_1 = require("vue");
var STORAGE_KEY = 'todos-vuejs-2.0';
var todoStorage = {
    uid: 0,
    fetch: function () {
        var todos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        todos.forEach(function (todo, index) {
            todo.id = index;
        });
        todoStorage.uid = todos.length;
        return todos;
    },
    save: function (todos) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    }
};
// visibility filters
exports.filters = {
    all: function (todos) {
        return todos;
    },
    active: function (todos) {
        return todos.filter(function (todo) {
            return !todo.completed;
        });
    },
    completed: function (todos) {
        return todos.filter(function (todo) {
            return todo.completed;
        });
    }
};
const TodoItem = vue_1.default.extend({
    functional: true,
    props: {
        todo: Object
    },
    render(createElement, context) {
        const parent = context.parent;
        const todo = context.props.todo;
        return <li key={todo.id} {...context.data} v-show={parent.filteredTodos.includes(todo)}>
      <div data-layer>
        <div class="view">
          <input id={"toggle-" + todo.id} class="toggle" type="checkbox" v-model={todo.completed}/>
          <label data-layer for={"toggle-" + todo.id}>{todo.completed ?
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="-10 -18 100 135" style="padding-right:10px"><circle cx="50" cy="50" r="50" fill="none" stroke="#bddad5" stroke-width="3"/><path fill="#5dc2af" d="M72 25L42 71 27 56l-4 4 20 20 34-52z"/></svg>
            : <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="-10 -18 100 135"><circle cx="50" cy="50" r="50" fill="none" stroke="#ededed" stroke-width="3"/></svg>}</label>
          <button data-layer data-layer-hover-depth="2" class="destroy" onclick={() => parent.removeTodo(todo)}>x</button>
        </div> 
        <div data-layer class="item">                       
          <div class="title" onclick={() => parent.editTodo(todo)}>{todo.title}</div>
          <input class="edit" type="text" spellcheck="false" v-model={todo.title} v-todo-focus="todo == editedTodo" onblur={() => parent.doneEdit(todo)} onkeyup={(event) => {
            if (event.key === 'Enter')
                parent.doneEdit(todo);
            if (event.key === 'Escape')
                parent.cancelEdit(todo);
        }}/>
        </div> 
      </div>
    </li>;
    }
});
const TodoMVC = vue_1.default.extend({
    components: { 'todo-item': TodoItem },
    // app initial state
    data: function () {
        return {
            todos: todoStorage.fetch(),
            newTodo: '',
            editedTodo: null,
            visibility: 'all',
            beforeEditCache: ''
        };
    },
    // watch todos change for localStorage persistence
    watch: {
        todos: {
            handler: function (todos) {
                todoStorage.save(todos);
            },
            deep: true
        }
    },
    // computed properties
    // http://vuejs.org/guide/computed.html
    computed: {
        filteredTodos: function () {
            return exports.filters[this.visibility](this.todos);
        },
        remaining: function () {
            return exports.filters.active(this.todos).length;
        },
        allDone: {
            get: function () {
                return this.remaining === 0;
            },
            set: function (value) {
                this.todos.forEach(function (todo) {
                    todo.completed = value;
                });
            }
        }
    },
    filters: {
        pluralize: function (n) {
            return n === 1 ? 'item' : 'items';
        }
    },
    // methods that implement data logic.
    // note there's no DOM manipulation here at all.
    methods: {
        addTodo: function () {
            var value = this.newTodo && this.newTodo.trim();
            if (!value) {
                return;
            }
            this.todos.push({
                id: todoStorage.uid++,
                title: value,
                completed: false
            });
            this.newTodo = '';
        },
        removeTodo: function (todo) {
            this.todos.splice(this.todos.indexOf(todo), 1);
        },
        editTodo: function (todo) {
            this.beforeEditCache = todo.title;
            this.editedTodo = todo;
        },
        doneEdit: function (todo) {
            if (!this.editedTodo) {
                return;
            }
            this.editedTodo = null;
            todo.title = todo.title.trim();
            if (!todo.title) {
                this.removeTodo(todo);
            }
        },
        cancelEdit: function (todo) {
            this.editedTodo = null;
            todo.title = this.beforeEditCache;
        },
        removeCompleted: function () {
            this.todos = exports.filters.active(this.todos);
        }
    },
    // a custom directive to wait for the DOM to be updated
    // before focusing on the input field.
    // http://vuejs.org/guide/custom-directive.html
    directives: {
        'todo-focus': function (el, binding) {
            if (binding.value) {
                el.focus();
            }
        }
    },
    render() {
        return <div class="container" data-layer-pixel-ratio="0.5">
        <section data-layer data-layer-pixel-ratio="0.5" class="todoapp">
        <header class="header">
            <h1 data-layer>todos</h1>
            <div data-layer>
              <input class="new-todo" spellcheck="false" autofocus autocomplete="off" placeholder="What needs to be done?" v-model={this.newTodo} onkeyup={(e) => {
            if (e.key === 'Enter') {
                this.addTodo();
                e.target.blur();
            }
        }}/>
            </div>
        </header>
        <section class="main" v-show={this.todos.length}>
            <input id="toggle-all" class="toggle-all" type="checkbox" v-model={this.allDone}/>
            <label for="toggle-all"><div data-layer>❯</div></label>
            <ul class="todo-list">{this.todos.map(todo => {
            const classes = [];
            if (todo.completed)
                classes.push('completed');
            if (todo === this.editedTodo)
                classes.push('editing');
            return <todo-item class={`todo ${classes.join(' ')}`} todo={todo}/>;
        })}</ul>
        </section>
        <footer class="footer" v-show={this.todos.length}>
            <span data-layer class="todo-count">
            <strong>{this.remaining}</strong> {this.$options.filters.pluralize(this.remaining)} left
            </span>
            <ul class="filters">
            <li><a data-layer data-layer-hover-depth="1" href="#/all" class={this.visibility == 'all' ? 'selected' : ''}>All</a></li>
            <li><a data-layer data-layer-hover-depth="1" href="#/active" class={this.visibility == 'active' ? 'selected' : ''}>Active</a></li>
            <li><a data-layer data-layer-hover-depth="1" href="#/completed" class={this.visibility == 'completed' ? 'selected' : ''}>Completed</a></li>
            </ul>
            <button data-layer data-layer-hover-depth="1" class="clear-completed" onclick={this.removeCompleted} v-show={this.todos.length > this.remaining}>
            Clear completed
            </button>
        </footer>
        </section>
        <footer data-layer class="info">
        <p>Click to edit a todo</p>
        <p>Written by <a data-layer data-layer-hover-depth="1" href="http://ael.gatech.edu/lab/author/gheric/">&nbsp;Gheric Speiginer</a></p>
        <p>Part of <a data-layer data-layer-hover-depth="1" href="http://todomvc.com">TodoMVC</a></p>
        </footer>
    </div>;
    }
});
exports.default = TodoMVC;
//# sourceMappingURL=TodoMVC.jsx.map