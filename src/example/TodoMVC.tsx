import Vue from 'vue'

export interface Todo {
  id:number, title:string, completed:boolean
}

var STORAGE_KEY = 'todos-vuejs-2.0'
var todoStorage = {
  uid: 0,
  fetch: function () : Todo[] {
    var todos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    todos.forEach(function (todo, index) {
      todo.id = index
    })
    todoStorage.uid = todos.length
    return todos
  },
  save: function (todos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }
}

// visibility filters
export const filters = {
  all: function (todos:Todo[]) {
    return todos
  },
  active: function (todos:Todo[]) {
    return todos.filter(function (todo) {
      return !todo.completed
    })
  },
  completed: function (todos:Todo[]) {
    return todos.filter(function (todo) {
      return todo.completed
    })
  }
}

export default Vue.extend({
  // app initial state
  data: function() {
    return {
      todos: todoStorage.fetch(),
      newTodo: '',
      editedTodo: null as Todo|null,
      visibility: 'all' as 'all'|'active'|'completed',
      beforeEditCache: ''
    }
  },

  // watch todos change for localStorage persistence
  watch: {
    todos: {
      handler: function (todos) {
        todoStorage.save(todos)
      },
      deep: true
    }
  },

  // computed properties
  // http://vuejs.org/guide/computed.html
  computed: {
    filteredTodos: function () {
      return filters[this.visibility](this.todos) as Todo[]
    },
    remaining: function () {
      return filters.active(this.todos).length
    },
    allDone: {
      get: function () {
        return (this as any).remaining === 0
      },
      set: function (value) {
        this.todos.forEach(function (todo) {
          todo.completed = value
        })
      }
    }
  },

  filters: {
    pluralize: function (n) {
      return n === 1 ? 'item' : 'items'
    }
  },

  // methods that implement data logic.
  // note there's no DOM manipulation here at all.
  methods: {
    addTodo: function () {
      var value = this.newTodo && this.newTodo.trim()
      if (!value) {
        return
      }
      this.todos.push({
        id: todoStorage.uid++,
        title: value,
        completed: false
      })
      this.newTodo = ''
    },

    removeTodo: function (todo: Todo) {
      this.todos.splice(this.todos.indexOf(todo), 1)
    },

    editTodo: function (todo: Todo) {
      this.beforeEditCache = todo.title
      this.editedTodo = todo
    },

    doneEdit: function (todo: Todo) {
      if (!this.editedTodo) {
        return
      }
      this.editedTodo = null
      todo.title = todo.title.trim()
      if (!todo.title) {
        this.removeTodo(todo)
      }
    },

    cancelEdit: function (todo: Todo) {
      this.editedTodo = null
      todo.title = this.beforeEditCache
    },

    removeCompleted: function () {
      this.todos = filters.active(this.todos)
    }
  },

  // a custom directive to wait for the DOM to be updated
  // before focusing on the input field.
  // http://vuejs.org/guide/custom-directive.html
  directives: {
    'todo-focus': function (el, binding) {
      if (binding.value) {
        el.focus()
      }
    }
  },

  render() {
    return <div class="container">
        <section data-layer class="todoapp">
        <header data-layer class="header">
            <h1>todos</h1>
            <input class="new-todo"
            autofocus autocomplete="off"
            placeholder="What needs to be done?"
            v-model={this.newTodo}
            onkeyup={(e:KeyboardEvent) => {
              if (e.key === 'Enter') this.addTodo()
            }}/>
        </header>
        <section class="main" v-show={this.todos.length}>
            <input id="toggle-all" class="toggle-all" type="checkbox" v-model={this.allDone} />
            <label for="toggle-all">Mark all as complete</label>
            <ul class="todo-list">{
              this.filteredTodos.map(todo => {
                const classes = [] as string[]
                if (todo.completed) classes.push('completed')
                if (todo === this.editedTodo) classes.push('editing')
                return  <li data-layer class={`todo ${classes.join(' ')}`} key={todo.id}>
                        <div class="view">
                          <input class="toggle" type="checkbox" v-model={todo.completed} />
                          <label ondblclick={() => this.editTodo(todo)}>{ todo.title }</label>
                          <button class="destroy" onclick={() => this.removeTodo(todo)}></button>
                        </div>
                        <input class="edit" type="text"
                          v-model={todo.title}
                          v-todo-focus="todo == editedTodo"
                          onblur={ () => this.doneEdit(todo) }
                          onkeyup={ (event:KeyboardEvent) => {
                            if (event.key === 'Enter') this.doneEdit(todo)
                            if (event.key === 'Escape') this.cancelEdit(todo)
                          }}/>
                        </li>
                })
              }</ul>
        </section>
        <footer data-layer class="footer" v-show={this.todos.length}>
            <span class="todo-count">
            <strong>{ this.remaining }</strong> { this.$options.filters!.pluralize(this.remaining) } left
            </span>
            <ul class="filters">
            <li><a href="#/all" class={this.visibility == 'all' ? 'selected' : ''}>All</a></li>
            <li><a href="#/active" class={this.visibility == 'active' ? 'selected' : ''}>Active</a></li>
            <li><a href="#/completed" class={this.visibility == 'completed' ? 'selected' : ''}>Completed</a></li>
            </ul>
            <button class="clear-completed" onclick={this.removeCompleted} v-show={this.todos.length > this.remaining}>
            Clear completed
            </button>
        </footer>
        </section>
        <footer class="info">
        <p>Double-click to edit a todo</p>
        <p>Written by <a href="http://ael.gatech.edu/lab/author/gheric/">Gheric Speiginer</a></p>
        <p>Part of <a href="http://todomvc.com">TodoMVC</a></p>
        </footer>
    </div>
  }
})
