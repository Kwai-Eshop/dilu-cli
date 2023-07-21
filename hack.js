/**
 * 使用ts-node开发时，如果存在三方的类库报错，出现类型 错误 Warning: Accessing non-existent property 'Symbol(nodejs.util.inspect.custom)' of module exports inside circular dependency
 * 可以在这里全局定义
 */
Object.defineProperties(global, {
  madge: {
    value: require("madge"),
  },
});
