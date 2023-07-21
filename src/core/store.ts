import _ from "lodash";

export interface StoreMeta extends Record<any, any> {
  resolved: string;
  namespace: string;
}
/**
 * The plugin store
 * This is used to store plugin (npm packages) reference and instantiate them when
 * requested.
 * @constructor
 * @private
 */
export default class {
  private _plugins: Record<string, any>;
  private _meta: Record<string, StoreMeta>;
  constructor() {
    this._plugins = {};
    this._meta = {};
  }
  /**
   * Store a module under the namespace key
   * @param {String}          namespace - The key under which the plugin can be retrieved
   * @param {String|Function} plugin - A plugin module or a module path
   */
  add(
    namespace: string,
    plugin: string | Function,
    playload?: Record<any, any>
  ): unknown {
    if (typeof plugin === "string") {
      this._storeAsPath(namespace, plugin, playload);
      return;
    }

    this._storeAsModule(namespace, plugin, playload);
  }
  private _storeAsPath(
    namespace: string,
    path: string,
    playload?: Record<any, any>
  ) {
    this._meta[namespace] = {
      resolved: path,
      namespace: namespace,
      ...playload,
    };

    Object.defineProperty(this._plugins, namespace, {
      get: function () {
        try {
          var plugin = require(path);
        } catch (e) {
          console.dir(e);
        }
        return plugin;
      },
      enumerable: true,
      configurable: true,
    });
  }
  private _storeAsModule(
    namespace: string,
    plugin: Function,
    playload?: Record<any, any>
  ) {
    this._meta[namespace] = {
      resolved: "unknown",
      namespace: namespace,
      ...playload,
    };

    this._plugins[namespace] = plugin;
  }
  /**
   * Get the module registered under the given namespace
   * @param  {String} namespace
   * @return {Module}
   */
  get(namespace: string): string | Function {
    var plugin = this._plugins[namespace];

    if (!plugin) {
      return;
    }

    return _.extend(plugin, this._meta[namespace]);
  }

  /**
   * Returns the list of registered namespace.
   * @return {Array} Namespaces array
   */

  namespaces(): Array<string> {
    return Object.keys(this._plugins);
  }

  /**
   * Get the stored plugins meta data
   * @return {Object} plugins metadata
   */

  getPluginsMeta(): Record<string, StoreMeta> {
    return this._meta;
  }
}
