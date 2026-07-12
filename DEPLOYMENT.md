Vercel Deployment Notes

- This project is a Vite React app. Vercel will detect and use the `build` script.
- Ensure `npm ci` and `npm run build` succeed in CI. A GitHub Action `CI` is included.
- `vercel.json` rewrites all routes to `index.html` for SPA routing.
- If using environment variables for Supabase, add them in Vercel dashboard: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Recommended steps:
1. Connect the GitHub repo in Vercel.
2. Set Environment Variables in Project Settings.
3. Deploy; check logs for `npm run build` output.
