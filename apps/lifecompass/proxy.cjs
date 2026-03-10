const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3004;

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url.startsWith('/proxy')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const targetUrl = data._targetUrl;
                const headers = data._headers || {};
                delete data._targetUrl;
                delete data._headers;

                const parsed = url.parse(targetUrl);
                const options = {
                    hostname: parsed.hostname,
                    port: parsed.port || 443,
                    path: parsed.path,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers
                    }
                };

                const proxyReq = https.request(options, proxyRes => {
                    res.writeHead(proxyRes.statusCode, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    proxyRes.pipe(res);
                });

                proxyReq.on('error', e => {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: e.message }));
                });

                proxyReq.write(JSON.stringify(data));
                proxyReq.end();
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`🔄 CORS Proxy running on http://localhost:${PORT}/proxy`);
    console.log('   Forward AI API requests through this proxy to avoid CORS issues');
});
