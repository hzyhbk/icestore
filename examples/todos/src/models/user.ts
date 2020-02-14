import { delay } from '../utils';

export interface User {
  name?: string;
  age?: number;
}

export interface UserStore {
  dataSource: User;
  auth: boolean;
  todos: number;
  login: () => void;
  setTodos: (todos: number) => void;
}

const store = {
  state: {
    dataSource: {
    },
    todos: 0,
    auth: false,
  },
  effects: {
    async login(state, actions) {
      await delay(1000);
      const dataSource = {
        name: 'Alvin',
      };
      const auth = true;
      actions.user.setState({
        dataSource,
        auth,
      });
    },
  },
  reducers: {
    setTodos(prevState, todos: number) {
      return { ...prevState, todos };
    },
    setState(prevState, nextState) {
      return {
        ...prevState,
        ...nextState,
      };
    },
  },
};

export default store;
