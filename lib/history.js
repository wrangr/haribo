var pages = {};
var links = {};


Object.defineProperty(exports, 'length', {
  get: function () { return Object.keys(pages).length; },
  set: function () {}
});


exports.addPage = function (page) {
  pages[page.id] = (pages[page.id] || 0) + 1;

  page._links.forEach(function (link) {
    if (!link.internal) { return; }
    var urlObj = link.instances[0].urlObj;
    if (links[link.id]) {
      links[link.id].count.push(link.count);
    } else {
      links[link.id] = {
        id: link.id,
        count: [ link.count ],
        inHome: exports.length === 1,
        pathParts: urlObj.path.split('/').length,
        queryParams: Object.keys(urlObj.query).length
      };
    }
  });
};


exports.hasPage = function (id) {
  return pages.hasOwnProperty(id);
};


//
// Choose next link to navigate (only applies when `options.max` is greater than
// one.
//
exports.pickNextLink = function () {
  var unvisited = Object.keys(links).reduce(function (memo, key) {
    if (!pages.hasOwnProperty(key)) { memo.push(links[key]); }
    return memo;
  }, []);

  if (!unvisited.length) { return null; }

  var inHome = unvisited.filter(function (link) { return link.inHome; });

  if (inHome.length) {
    unvisited = inHome;
  }

  var withLeastPathParts = unvisited.reduce(function (memo, link) {
    if (!memo.length || memo[0].pathParts === link.pathParts) {
      memo.push(link);
    } else if (link.pathParts < memo[0].pathParts) {
      memo = [ link ];
    }
    return memo;
  }, []);

  withLeastPathParts.sort(function (a, b) {
    var aCountTotal = a.count.reduce(function (memo, val) { return memo + val });
    var bCountTotal = b.count.reduce(function (memo, val) { return memo + val });
    return bCountTotal - aCountTotal;
  });

  return withLeastPathParts.shift();
};

