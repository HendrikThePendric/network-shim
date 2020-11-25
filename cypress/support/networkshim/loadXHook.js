/**
 * TODO: we need a better way of doing this. The version below, which is
 * commented out actually would be much better, since it doesn't use an
 * external asset file. However, for some reason, the only way I can get
 * `xhook.before` callback to run is by using this external file.
 * No idea why.
 */

// export default async function loadXHook(window, { handleStubbedRoute }) {
//     window.xhook = await import('xhook');
//     console.log('loadXHook', win.xhook);
//     win.xhook.before((request, callback) => {
//         try {
//             console.log('finding a fixture now...');
//             const fixture =
//                 'xhr' in request
//                     ? handleStubbedRoute({
//                           url: request.url.url,
//                           method: request.method.toUpperCase(),
//                           requestBody: request.body || null,
//                       })
//                     : handleStubbedRoute(request);

//             console.log('xHook found this fixture', fixture);
//             callback({
//                 status: fixture.status,
//                 text: fixture.responseBody,
//                 data: fixture.responseBody,
//                 headers: fixture.responseHeaders,
//             });
//         } catch (error) {
//             console.error('xHook catch', error);
//         }
//     });
// }

export default function loadXHook(window, { handleStubbedRoute }) {
    const script = window.document.createElement('script');
    script.onload = function () {
        window.xhook.before((request, callback) => {
            try {
                const fixture = handleStubbedRoute(request);
                console.log(fixture);
                callback({
                    status: fixture.status,
                    text: fixture.responseBody,
                    data: fixture.responseBody,
                    headers: fixture.responseHeaders,
                });
            } catch (error) {
                console.error('xHook catch', error);
            }
        });
    };
    script.src = '//unpkg.com/xhook@latest/dist/xhook.min.js';
    script.id = 'xhook';
    window.document.head.appendChild(script);
}
