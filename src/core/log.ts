"use strict";
const logSymbols = require("log-symbols");

type LogFn = (msg: string) => void;
export interface ILogger {
  log: (type: string, msg: string) => void;
  error: LogFn;
  info: LogFn;
  success: LogFn;
  warning: LogFn;
  write: LogFn;
}

const logger: ILogger = {
  log(type, msg) {
    var symbols = logSymbols[type] || logSymbols.info;

    console.log(symbols, msg);
  },
  error(msg) {
    this.log("error", msg);
  },
  info(msg) {
    this.log("info", msg);
  },
  success(msg) {
    this.log("success", msg);
  },
  warning(msg) {
    this.log("warning", msg);
  },
  write(msg) {
    console.log(msg);
  },
};

export default logger;
