var internals = {};


internals.pages = {};
internals.links = {};


Object.defineProperty(exports, 'length', {
  get: function () {

    return Object.keys(internals.pages).length;
  },
  set: function () {}
});


exports.addPage = function (page) {

  internals.pages[page.id] = (internals.pages[page.id] || 0) + 1;

  page._links.forEach(function (link) {

    if (!link.internal) { return; }
    var urlObj = link.instances[0].urlObj;
    if (internals.links[link.id]) {
      internals.links[link.id].count.push(link.count);
    } else {
      internals.links[link.id] = {
        id: link.id,
        count: [link.count],
        inHome: exports.length === 1,
        pathParts: urlObj.path.split('/').length,
        queryParams: Object.keys(urlObj.query).length
      };
    }
  });
};


exports.hasPage = function (id) {

  return internals.pages.hasOwnProperty(id);
};


//
// Choose next link to navigate (only applies when `options.max` is greater than
// one.
//
exports.pickNextLink = function () {

  var unvisited = Object.keys(internals.links).reduce(function (memo, key) {

    if (!exports.hasPage(key)) { memo.push(internals.links[key]); }
    return memo;
  }, []);

  if (!unvisited.length) { return null; }

  var inHome = unvisited.filter(function (link) {

    return link.inHome;
  });

  if (inHome.length) {
    unvisited = inHome;
  }

  var withLeastPathParts = unvisited.reduce(function (memo, link) {

    if (!memo.length || memo[0].pathParts === link.pathParts) {
      memo.push(link);
    } else if (link.pathParts < memo[0].pathParts) {
      memo = [link];
    }
    return memo;
  }, []);

  withLeastPathParts.sort(function (a, b) {

    var aCountTotal = a.count.reduce(function (memo, val) {

      return memo + val;
    });

    var bCountTotal = b.count.reduce(function (memo, val) {

      return memo + val;
    });

    return bCountTotal - aCountTotal;
  });

  return withLeastPathParts.shift();
};

