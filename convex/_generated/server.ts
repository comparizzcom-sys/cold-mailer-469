type HandlerConfig = {
  args?: unknown;
  handler: (...args: any[]) => any;
};

function passthrough<T extends HandlerConfig>(config: T): T {
  return config;
}

export const query = passthrough;
export const mutation = passthrough;
export const action = passthrough;
export const internalQuery = passthrough;
export const internalMutation = passthrough;
export const internalAction = passthrough;
