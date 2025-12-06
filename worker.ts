
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 这里可以处理 API 请求
    const url = new URL(request.url);
    
    if (url.pathname.startsWith("/api/")) {
      return new Response("API is working. D1 is bound.", { status: 200 });
    }

    // 对于其他请求，返回静态资源 (React App)
    // 注意：[assets] 配置会自动提供 env.ASSETS
    return env.ASSETS.fetch(request);
  },
};
