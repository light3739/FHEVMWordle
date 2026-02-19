// Required for SharedArrayBuffer support (WASM threads used by Zama FHE SDK)
// CRA picks up this file automatically from src/setupProxy.js
module.exports = function (app) {
    app.use((req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
        next();
    });
};
