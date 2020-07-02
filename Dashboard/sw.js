var version = 'v3::';

self.addEventListener("install", function(event) {
  event.waitUntil(
    // Fill cache with the offline fundamentals.
    caches.open(version + 'fundamentals')
      .then(function(cache) {
        return cache.addAll([
          '/css/fontawesome.min.css',
          '/css/home-esp.css',
          '/css/nunito.css',
          '/js/home-esp.js',
          '/index.html',
          '/webfonts/Nunito-Regular.eot',
          '/webfonts/Nunito-Regular.svg',
          '/webfonts/Nunito-Regular.ttf',
          '/webfonts/Nunito-Regular.woff',
          '/webfonts/Nunito-Regular.woff2',
          '/webfonts/Nunito-Bold.eot',
          '/webfonts/Nunito-Bold.svg',
          '/webfonts/Nunito-Bold.ttf',
          '/webfonts/Nunito-Bold.woff',
          '/webfonts/Nunito-Bold.woff2'
        ]);
      })
  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        // Return a promise that settles when all outdated caches are deleted.
        return Promise.all(
          keys
            .filter(function (key) {
              // Filter by keys that don't start with the latest version prefix.
              return !key.startsWith(version);
            })
            .map(function (key) {
              // Return a promise that's fulfilled when each outdated cache is deleted.
              return caches.delete(key);
            })
        );
      })
  );
});

self.addEventListener("fetch", function(event) {
  // Only cache HTTP GET requests
  if (event.request.method !== 'GET' || !(event.request.url.indexOf('http') === 0)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(cached) {
        // Request response even if it's cached, to ensure cached version stays updated.
        var networked = fetch(event.request)
          .then(fetchedFromNetwork, unableToResolve)
          .catch(unableToResolve);

        // Return cached response immediately if there is one, otherwise wait for network.
        return cached || networked;

        function fetchedFromNetwork(response) {
          // Copy response to be stored in the cache.
          var cacheCopy = response.clone();

          // Store response for this request, to speed up future requests.
          caches.open(version + 'pages')
            .then(function add(cache) {
              cache.put(event.request, cacheCopy);
            });

          return response;
        };

        function unableToResolve () {
          console.error('WORKER: fetch request failed in both cache and network.');
        };
      })
  );
});