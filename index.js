// ldap server with mysql backend
// author: selim eren bekçe
require('dotenv').config()

var ldap = require('ldapjs'),
  mysql = require("mysql"),
  server = ldap.createServer(),
  root_user = "root",
  root_pass = "secret",
  ldap_port = 1389,
  basedn = "cn=users,dc=ods,dc=example,dc=com.",
  // basedn = "ou=People,dc=moph,dc=go,dc=th",
  db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }),
  db_name = "`users2`",
  rev_map = { // reverse field mapping, used for building sql query
    "mail": "email",
    "cn": "username",
    "fn": "name",
    "sn": "surname"
  };

server.bind(basedn, function (req, res, next) {
  console.log('bind');
  console.log('basedn', basedn);
  var username = req.dn.toString(),
    password = req.credentials;
  username = username.substring(3, username.indexOf(", " + basedn));
  console.log("bind|" + username + "|" + password);
  // if user is root, just check its password right here
  if (root_user == username && root_pass == password) {
    req.is_root = 1;
    console.log("root");
    res.end();
    return next();
  } else {
    // query the mysql database and validate the user
    db.query("select c.* from " + db_name + " c where c.username='" + username + "' and c.password='" + password + "'", function (err, users) {
      if (err) {
        console.log("Error fetching users", err);
        return next(new ldap.LDAPError());
      }
      if (users.length <= 0) {
        console.log("invalid credentials");
        return next(new ldap.InvalidCredentialsError());
      } else {
        res.end();
        return next();
      }
    });
  }
});

// recursively prepares the sql query.
// it can handle 'and', 'or', 'substring' and 'equal' type filters.
// see http://ldapjs.org/filters.html to implement all.
function prepareQuery(filter) {
  var query = '';
  if (filter.type == 'and' || filter.type == 'or') {
    query += ' ( ';
    for (let i = 0; i < filter.filters.length; i++) {
      if (query.length > 3) query += filter.type;
      query += prepareQuery(filter.filters[i]);
    }
    query += ' ) ';
  }
  else if (filter.type == 'substring') {
    query += " c." + rev_map[filter.attribute] + " LIKE '" + filter.initial + "%' ";
  }
  else if (filter.type == 'equal') {
    query += " c." + rev_map[filter.attribute] + " = '" + filter.value + "' ";
  }
  return query;
}

server.search(basedn, function (req, res, next) {
  console.log('search');
  var binddn = req.connection.ldap.bindDN.toString();
  console.log(binddn, basedn);
  // cn=anonymous o=example
  var username = binddn.substring(3, binddn.indexOf(", " + basedn));
  console.log(binddn.indexOf(", " + basedn));
  console.log("search() username: " + username);
  var query = prepareQuery(req.filter).trim();
  if (query != '') {
    query = " where " + query;
  }

  //console.log(req.filter);
  console.log(`query: ${query}`);
  if (username == root_user) {
    db.query("select c.* from " + db_name + " c" + query, function (err, users) {
      if (err) {
        console.log("Error fetching users", err);
        return next(new ldap.LDAPError());
      }
      for (var i = 0; i < users.length; i++) {
        var user = {
          dn: "cn=" + users[i].username + ", " + basedn,
          attributes: {
            objectclass: ["top"],
            cn: users[i].username,
            mail: users[i].email,
            fn: users[i].name,
            sn: users[i].surname
          }
        };
        res.send(user);
      }
      res.end();
    });
  } else {
    res.end();
  }
});

server.listen(ldap_port, function () {
  console.log("LDAP server started at %s", server.url);
});
