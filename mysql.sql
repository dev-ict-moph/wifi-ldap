CREATE TABLE IF NOT EXISTS `users2` (
  `id` int(5) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL,
  `surname` varchar(50) NOT NULL,
  `email` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;
INSERT INTO `users2` (`username`, `password`, `name`, `surname`, `email`) VALUES
('jane', 'demo', 'Jane', 'Doe', 'jane@example.com' ),
('john', 'demo', 'John', 'Doe', 'john@example.com' ),
('eren', 'demo', 'Eren', 'Bekce', 'eren@example.com' );