// MySQL test: (create on database 'abook' with username 'abook' and password 'abook')
//
// CREATE TABLE IF NOT EXISTS `users` (
//   `id` int(5) unsigned NOT NULL AUTO_INCREMENT,
//   `username` varchar(50) NOT NULL,
//   `password` varchar(50) NOT NULL,
//   PRIMARY KEY (`id`),
//   KEY `username` (`username`)
// ) ENGINE=InnoDB  DEFAULT CHARSET=utf8;
// INSERT INTO `users` (`username`, `password`) VALUES
// ('demo', 'demo');
// CREATE TABLE IF NOT EXISTS `contacts` (
//   `id` int(5) unsigned NOT NULL AUTO_INCREMENT,
//   `user_id` int(5) unsigned NOT NULL,
//   `name` varchar(100) NOT NULL,
//   `email` varchar(255) NOT NULL,
//   PRIMARY KEY (`id`),
//   KEY `user_id` (`user_id`)
// ) ENGINE=InnoDB  DEFAULT CHARSET=utf8;
// INSERT INTO `contacts` (`user_id`, `name`, `email`) VALUES
// (1, 'John Doe', 'john.doe@example.com'),
// (1, 'Jane Doe', 'jane.doe@example.com');
//
require('dotenv').config()
const ldap = require('ldapjs');
const mysql = require("mysql");
const server = ldap.createServer();
const addrbooks = {};
const userinfo = {};
const ldap_port = 389;
const basedn = "dc=example, dc=com";
const company = "Example";
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.query("SELECT c.*,u.username,u.password " +
    "FROM contacts c JOIN users u ON c.user_id=u.id",
    (err, contacts) => {
        if (err) {
            console.log("Error fetching contacts", err);
            process.exit(1);
        }

        for (const contact of contacts) {
            if (!addrbooks.hasOwnProperty(contact.username)) {
                addrbooks[contact.username] = [];
                userinfo["cn=" + contact.username + ", " + basedn] = {
                    abook: addrbooks[contact.username],
                    pwd: contact.password
                };
            }

            let p = contact.name.indexOf(" ");
            if (p != -1)
                contact.firstname = contact.name.substr(0, p);
            p = contact.name.lastIndexOf(" ");
            if (p != -1)
                contact.surname = contact.name.substr(p + 1);

            addrbooks[contact.username].push({
                dn: "cn=" + contact.name + ", " + basedn,
                attributes: {
                    objectclass: ["top"],
                    cn: contact.name,
                    mail: contact.email,
                    givenname: contact.firstname,
                    sn: contact.surname,
                    ou: company
                }
            });
        }

        server.bind(basedn, (req, res, next) => {
            const username = req.dn.toString();
            const password = req.credentials;

            if (!userinfo.hasOwnProperty(username) ||
                userinfo[username].pwd != password) {
                return next(new ldap.InvalidCredentialsError());
            }

            res.end();
            return next();
        });

        server.search(basedn, (req, res, next) => {
            const binddn = req.connection.ldap.bindDN.toString();

            if (userinfo.hasOwnProperty(binddn)) {
                for (const abook of userinfo[binddn].abook) {
                    if (req.filter.matches(abook.attributes))
                        res.send(abook);
                }
            }
            res.end();
        });

        server.listen(ldap_port, () => {
            console.log("Addressbook started at %s", server.url);
        });
    });