import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import transform from 'lodash.transform';
import { createContainer } from './createContainer';
import { Model } from './types';

const isDev = process.env.NODE_ENV !== 'production';

export function createStore(models: {[namespace: string]: Model}) {
  const modelActions = {};
  const containers = transform(models, (result, model, namespace) => {
    const { state: defineState = {}, reducers = [], effects = [] } = model;
    modelActions[namespace] = {};

    function useModel({ initialState }) {
      const preloadedState = initialState || defineState;
      const [state, setState] = useState(preloadedState);

      const [effectsInitialState, effectsInitialIdentifier] = useMemo(() => {
        const states = {};
        const identifiers = {};
        Object.keys(effects).forEach((name) => {
          const state = {
            isLoading: false,
            error: null,
            playload: [],
            identifier: 0
          };
          states[name] = state;
          identifiers[name] = state.identifier;
        });
        return [states, identifiers];
      }, []);
      const effectsIdentifier = useRef(effectsInitialIdentifier);
      const [effectsState, setEffectsState] = useState(() => (effectsInitialState));
      const setEffectState = useCallback((name, nextState) => {
        setEffectsState(prevState => ({
          ...prevState,
          [name]: {
            ...prevState[name],
            ...nextState(prevState[name]),
          }
        }));
      }, []);
      const effectsIdentifierState = Object.keys(effectsState).map((name) => effectsState[name].identifier);

      useEffect(() => {
        Object.keys(effectsState).forEach((name) => {
          const { identifier, playload } = effectsState[name];
          if (identifier && identifier !== effectsIdentifier.current[name].identifier) {
            effectsIdentifier.current = {
              ...effectsIdentifier.current,
              [name]: { identifier, },
            };
            (async (...args) => {
              setEffectState(name, () => ({
                isLoading: true,
                error: null,
              }));
              try {
                await effects[name].apply(actions, [...args, state, modelActions]);
                setEffectState(name, () => ({
                  isLoading: false,
                  error: null,
                }));
              } catch (error) {
                setEffectState(name, () => ({
                  isLoading: false,
                  error,
                }));
              }
            })(...playload)
          }
        });
      }, [effectsIdentifierState]);

      const actions = useMemo(() => {
        const reducerActions = {};
        Object.keys(reducers).forEach((name) => {
          const fn = reducers[name];
          reducerActions[name] = (...args) => setState((prevState) => fn(prevState, ...args));
        });

        const effectActions = {};
        Object.keys(effects).forEach((name) => {
          effectActions[name] = function(...args) {
            setEffectState(name, ({ identifier }) => ({ playload: args, identifier: identifier + 1, }));
          };
        });
        return { ...reducerActions, ...effectActions };
      }, []);

      modelActions[namespace] = actions;
      return [{...state, effects: effectsState}, actions];
    }

    if (isDev) {
      useModel.displayName = namespace;
    }

    result[namespace] = createContainer(
      useModel,
      value => value[0], // state
      value => value[1]  // actions
    );
  }, {});

  function Provider({ children, initialStates = {} }) {
    Object.keys(containers).forEach(namespace => {
      const [ ModelProvider ] = containers[namespace];
      children = <ModelProvider initialState={initialStates[namespace]}>
        {children}
      </ModelProvider>;
    });
    return <>{children}</>;
  }

  function useModelState(namespace: string) {
    const [, useModelState ] = containers[namespace];
    return useModelState();
  }

  function useModelAction(namespace: string) {
    const [, , useModelAction ] = containers[namespace];
    return useModelAction();
  }

  function useModel(namespace: string) {
    return [useModelState(namespace), useModelAction(namespace)];
  }

  function connect(namespace: string, mapStateToProps?, mapActionsToProps?) {
    return (Component) => {
      return (props): React.ReactElement => {
        const stateProps = mapStateToProps ? mapStateToProps(useModelState(namespace)) : {};
        const actionsProps = mapActionsToProps ? mapActionsToProps(useModelAction(namespace)) : {};
        return (
          <Component
            {...stateProps}
            {...actionsProps}
            {...props}
          />
        );
      };
    };
  }

  return {
    Provider,
    useModel,
    useModelState,
    useModelAction,
    connect,
  };
}
