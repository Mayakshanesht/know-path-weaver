import type { Plugin, ProxyOptions } from 'vite';

const sandboxApi = 'http://127.0.0.1:55321';

/** Keep the disposable demo on one browser origin, including forwarded previews. */
export function couponSandboxDevelopment() {
  const routes: Record<string, ProxyOptions> = Object.fromEntries(
    ['/auth/v1', '/rest/v1', '/sandbox', '/api'].map(prefix => [prefix, {
      target: sandboxApi,
      changeOrigin: true,
      headers: { origin: 'http://localhost:4179' },
    }]),
  );
  const proxy: Record<string, ProxyOptions> = {
    '/api/invoice-download': {
      ...routes['/api'],
      selfHandleResponse: true,
      configure(server) {
        server.on('proxyRes', (upstream, _request, response) => {
          const chunks: Buffer[] = [];
          upstream.on('data', chunk => chunks.push(Buffer.from(chunk)));
          upstream.on('end', () => {
            let body = Buffer.concat(chunks);
            try {
              const result = JSON.parse(body.toString());
              if (typeof result.url === 'string' && result.url.startsWith(`${sandboxApi}/sandbox-receipts/`)) {
                result.url = result.url.slice(sandboxApi.length);
                body = Buffer.from(JSON.stringify(result));
              }
            } catch { /* Keep non-JSON error responses unchanged. */ }
            const headers = { ...upstream.headers };
            delete headers['content-length'];
            delete headers['transfer-encoding'];
            response.writeHead(upstream.statusCode ?? 502, headers);
            response.end(body);
          });
          upstream.on('error', () => { response.destroy(); });
        });
      },
    },
    ...routes,
  };
  const plugin: Plugin = {
    name: 'coupon-sandbox-signin-shortcuts',
    transformIndexHtml: () => [
      { tag: 'style', children: 'body{padding-bottom:110px!important}#coupon-demo-tools{position:fixed;bottom:0;left:0;right:0;z-index:10001;background:#fef3c7;color:#78350f;padding:10px 16px;font:13px system-ui;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;box-shadow:0 -1px 6px #0003}#coupon-demo-tools button{background:#fff;border:1px solid #b45309;border-radius:6px;padding:7px 10px;cursor:pointer;color:#78350f;font:inherit}#coupon-demo-tools button:disabled{opacity:.6;cursor:wait}#coupon-demo-tools a{text-decoration:underline;font-weight:600;color:inherit}#coupon-demo-tools [role=status]{flex-basis:100%;text-align:center}', injectTo: 'head' },
      { tag: 'div', attrs: { id: 'coupon-demo-tools', 'aria-label': 'Local demo tools' },
        children: '<strong>LOCAL DEMO · No real payments</strong><button type="button" data-demo-account="admin">Sign in as demo admin</button><button type="button" data-demo-account="student">Sign in as demo student</button><a href="/sandbox" target="_blank" rel="noopener">Test instructions</a><span role="status" id="coupon-demo-status">Demo accounts only. Your usual account is separate.</span>', injectTo: 'body' },
      { tag: 'script', attrs: { type: 'module' }, children: `
        const tools = document.getElementById('coupon-demo-tools');
        const status = document.getElementById('coupon-demo-status');
        const buttons = [...tools.querySelectorAll('button[data-demo-account]')];
        for (const button of buttons) button.addEventListener('click', async () => {
          for (const item of buttons) item.disabled = true;
          status.textContent = 'Signing in to the local demo…';
          try {
            const { supabase } = await import('/src/integrations/supabase/client.ts');
            if (new URL(supabase.supabaseUrl).origin !== location.origin) {
              throw new Error('Refresh this page to use the updated local connection.');
            }
            const account = button.dataset.demoAccount;
            const { error } = await supabase.auth.signInWithPassword({
              email: account + '@demo.knowgraph.test', password: 'Demo2027!'
            });
            if (error) throw error;
            location.assign(account === 'admin' ? '/admin' : '/courses');
          } catch (error) {
            status.textContent = error instanceof Error ? error.message : 'Demo login failed. Refresh and try again.';
            for (const item of buttons) item.disabled = false;
          }
        });
      `, injectTo: 'body' },
    ],
  };
  return { proxy, plugin };
}
