// ldap server with mysql backend
// author: selim eren bekçe
require('dotenv').config()
// console.log(process.env)
var ldap = require('ldapjs'),
  mysql = require("mysql"),
  server = ldap.createServer(),
  root_user = "root",
  root_pass = "secret",
  ldap_port = 1389,
  // basedn = "cn=users",
  basedn = "o=moph,ou=people",
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

// function authorize(req, res, next) {
//   if (!req.connection.ldap.bindDN.equals('cn=root'))
//     return next(new ldap.InsufficientAccessRightsError());

//   return next();
// }

// server.search("cn=root", function (req, res, next) {
//   console.log('test');
// });

server.search(basedn, function (req, res, next) {

  console.log('search');
  var binddn = req.connection.ldap.bindDN.toString();
  // console.log(req.connection.ldap._bindDN.rdns[0]);
  // console.log(binddn, basedn);
  // cn=anonymous o=example
  // cn=anonymous ou=People, dc=moph, dc=go, dc=th
  // var username = binddn.substring(3, binddn.indexOf(", " + basedn));
  // console.log(binddn.indexOf(", " + basedn));
  // username = 'root';
  // console.log("search() username: " + username);
  var query = prepareQuery(req.filter).trim();
  if (query != '') {
    query = " where " + query;
  }

  //console.log(req.filter);
  // console.log(`query: ${query}`);
  // console.log(`${username}==${root_user} ${username == root_user}`);
  if (true) {
    db.query("select c.* from " + db_name + " c" + query, function (err, users) {
      if (err) {
        console.log("Error fetching users", err);
        return next(new ldap.LDAPError());
      }
      for (var i = 0; i < users.length; i++) {
        var user = {
          dn: `cn=${users[i].username},${basedn}`,
          attributes: {
            objectclass: ["top"],
            cn: users[i].username,
            uid: users[i].username,
            mail: users[i].email,
            fn: users[i].name,
            sn: users[i].surname
          }
        };
        console.log(user);
        res.send(user);
      }
      res.end();
    });
  } else {
    res.end();
  }
});


server.del(basedn, (req, res, next) => {
  console.log('DN: ' + req.dn.toString());
  res.end();
});
server.modify(basedn, (req, res, next) => {
  console.log('DN: ' + req.dn.toString());
  console.log('changes:');
  for (const c of req.changes) {
    console.log('  operation: ' + c.operation);
    console.log('  modification: ' + c.modification.toString());
  }
  res.end();
});

server.compare(basedn, (req, res, next) => {
  console.log('DN: ' + req.dn.toString());
  console.log('attribute name: ' + req.attribute);
  console.log('attribute value: ' + req.value);
  res.end(req.value === 'foo');
});

server.modifyDN(basedn, (req, res, next) => {
  console.log('DN: ' + req.dn.toString());
  console.log('new RDN: ' + req.newRdn.toString());
  console.log('deleteOldRDN: ' + req.deleteOldRdn);
  console.log('new superior: ' +
    (req.newSuperior ? req.newSuperior.toString() : ''));

  res.end();
});

server.exop('1.3.6.1.4.1.4203.1.11.3', (req, res, next) => {
  console.log('name: ' + req.name);
  console.log('value: ' + req.value);
  res.value = 'u:xxyyz@EXAMPLE.NET';
  res.end();
  return next();
});

server.unbind( (req, res, next) => {
  console.log('unbind');
  return next();
});


server.add(basedn, (req, res, next) => {
  console.log('DN: ' + req.dn.toString());
  console.log('Entry attributes: ' + req.toObject().attributes);
  res.end();
});


server.listen(ldap_port, function () {
  console.log("LDAP server started at %s", server.url);
});

