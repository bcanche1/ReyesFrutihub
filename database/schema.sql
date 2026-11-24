-- =========================================================
-- ReyesFruitHub · Esquema de base de datos (MySQL / MariaDB)
-- Motor InnoDB, utf8mb4. Las existencias se llevan por LOTE
-- para poder vender primero lo que caduca antes (PEPS).
-- El instalador (database/instalar.php) crea la base y ejecuta este archivo.
-- =========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW  IF EXISTS v_existencias;
DROP TABLE IF EXISTS mermas, venta_detalle, ventas, pedido_historial, pedido_detalle, pedidos,
  compra_detalle, compras, lotes, productos, proveedor_categoria, proveedores, categorias, usuarios;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE usuarios (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  rol            ENUM('admin','cliente') NOT NULL DEFAULT 'cliente',
  telefono       VARCHAR(20)  NULL,
  direccion      VARCHAR(255) NULL,
  activo         TINYINT(1)   NOT NULL DEFAULT 1,
  creado         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categorias (
  id      VARCHAR(30) PRIMARY KEY,
  nombre  VARCHAR(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE proveedores (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  contacto      VARCHAR(120) NULL,
  telefono      VARCHAR(20)  NOT NULL,
  email         VARCHAR(160) NULL,
  dias_entrega  VARCHAR(80)  NULL,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  notas         TEXT NULL,
  creado        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE proveedor_categoria (
  proveedor_id  INT UNSIGNED NOT NULL,
  categoria_id  VARCHAR(30)  NOT NULL,
  PRIMARY KEY (proveedor_id, categoria_id),
  CONSTRAINT fk_pc_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE CASCADE,
  CONSTRAINT fk_pc_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE productos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(80)  NOT NULL,
  categoria_id  VARCHAR(30)  NOT NULL,
  unidad        ENUM('kg','pieza','manojo') NOT NULL DEFAULT 'kg',
  precio        DECIMAL(10,2) NOT NULL,
  costo         DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_minimo  DECIMAL(10,2) NOT NULL DEFAULT 0,
  vida_dias     SMALLINT UNSIGNED NOT NULL DEFAULT 7,
  proveedor_id  INT UNSIGNED NULL,
  imagen        VARCHAR(255) NULL,
  forma         VARCHAR(20)  NOT NULL DEFAULT 'redondo',
  color         VARCHAR(9)   NOT NULL DEFAULT '#f59e0b',
  fondo         VARCHAR(12)  NOT NULL DEFAULT 'orange',
  destacado     TINYINT(1)   NOT NULL DEFAULT 0,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  descripcion   VARCHAR(255) NULL,
  UNIQUE KEY uq_productos_nombre (nombre),
  KEY ix_productos_categoria (categoria_id),
  CONSTRAINT ck_productos_precio CHECK (precio > 0),
  CONSTRAINT ck_productos_costo  CHECK (costo >= 0),
  CONSTRAINT ck_productos_minimo CHECK (stock_minimo >= 0),
  CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  CONSTRAINT fk_productos_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE compras (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proveedor_id  INT UNSIGNED NOT NULL,
  fecha         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total         DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado        ENUM('recibida','cancelada') NOT NULL DEFAULT 'recibida',
  usuario_id    INT UNSIGNED NULL,
  KEY ix_compras_fecha (fecha),
  CONSTRAINT fk_compras_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
  CONSTRAINT fk_compras_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE compra_detalle (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  compra_id    INT UNSIGNED NOT NULL,
  producto_id  INT UNSIGNED NOT NULL,
  cantidad     DECIMAL(10,2) NOT NULL,
  costo        DECIMAL(10,2) NOT NULL,
  CONSTRAINT ck_cd_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_cd_compra   FOREIGN KEY (compra_id)   REFERENCES compras(id) ON DELETE CASCADE,
  CONSTRAINT fk_cd_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lotes (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id       INT UNSIGNED NOT NULL,
  proveedor_id      INT UNSIGNED NULL,
  compra_id         INT UNSIGNED NULL,
  cantidad          DECIMAL(10,2) NOT NULL,
  cantidad_inicial  DECIMAL(10,2) NOT NULL,
  fecha_entrada     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_caducidad   DATETIME NOT NULL,
  KEY ix_lotes_peps (producto_id, fecha_caducidad),
  CONSTRAINT ck_lotes_cantidad CHECK (cantidad >= 0 AND cantidad <= cantidad_inicial),
  CONSTRAINT fk_lotes_producto  FOREIGN KEY (producto_id)  REFERENCES productos(id),
  CONSTRAINT fk_lotes_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL,
  CONSTRAINT fk_lotes_compra    FOREIGN KEY (compra_id)    REFERENCES compras(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pedidos (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  folio       VARCHAR(20) NULL,
  cliente_id  INT UNSIGNED NOT NULL,
  fecha       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado      ENUM('pendiente','preparando','listo','entregado','cancelado') NOT NULL DEFAULT 'pendiente',
  entrega     ENUM('recoger','domicilio') NOT NULL DEFAULT 'recoger',
  direccion   VARCHAR(255) NULL,
  notas       VARCHAR(500) NULL,
  total       DECIMAL(12,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_pedidos_folio (folio),
  KEY ix_pedidos_estado (estado),
  CONSTRAINT fk_pedidos_cliente FOREIGN KEY (cliente_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pedido_detalle (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id    INT UNSIGNED NOT NULL,
  producto_id  INT UNSIGNED NOT NULL,
  nombre       VARCHAR(80) NOT NULL,
  unidad       ENUM('kg','pieza','manojo') NOT NULL,
  cantidad     DECIMAL(10,2) NOT NULL,
  precio       DECIMAL(10,2) NOT NULL,
  CONSTRAINT ck_pd_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_pd_pedido   FOREIGN KEY (pedido_id)   REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pd_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pedido_historial (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id   INT UNSIGNED NOT NULL,
  estado      ENUM('pendiente','preparando','listo','entregado','cancelado') NOT NULL,
  fecha       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id  INT UNSIGNED NULL,
  CONSTRAINT fk_ph_pedido  FOREIGN KEY (pedido_id)  REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_ph_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ventas (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  folio       VARCHAR(20) NULL,
  fecha       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  canal       ENUM('mostrador','en_linea') NOT NULL DEFAULT 'mostrador',
  cliente_id  INT UNSIGNED NULL,
  pedido_id   INT UNSIGNED NULL,
  metodo      ENUM('efectivo','tarjeta') NOT NULL DEFAULT 'efectivo',
  total       DECIMAL(12,2) NOT NULL DEFAULT 0,
  usuario_id  INT UNSIGNED NULL,
  UNIQUE KEY uq_ventas_folio (folio),
  UNIQUE KEY uq_ventas_pedido (pedido_id),          -- un pedido genera a lo más una venta
  KEY ix_ventas_fecha (fecha),
  CONSTRAINT fk_ventas_cliente FOREIGN KEY (cliente_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_ventas_pedido  FOREIGN KEY (pedido_id)  REFERENCES pedidos(id)  ON DELETE SET NULL,
  CONSTRAINT fk_ventas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE venta_detalle (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  venta_id     INT UNSIGNED NOT NULL,
  producto_id  INT UNSIGNED NOT NULL,
  nombre       VARCHAR(80) NOT NULL,
  unidad       ENUM('kg','pieza','manojo') NOT NULL,
  cantidad     DECIMAL(10,2) NOT NULL,
  precio       DECIMAL(10,2) NOT NULL,
  CONSTRAINT ck_vd_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_vd_venta    FOREIGN KEY (venta_id)    REFERENCES ventas(id) ON DELETE CASCADE,
  CONSTRAINT fk_vd_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mermas (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id  INT UNSIGNED NOT NULL,
  cantidad     DECIMAL(10,2) NOT NULL,
  motivo       VARCHAR(80) NOT NULL,
  fecha        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id   INT UNSIGNED NULL,
  CONSTRAINT ck_mermas_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_mermas_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_mermas_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existencia por producto: suma de lotes y caducidad más próxima con producto disponible
CREATE VIEW v_existencias AS
SELECT p.id AS producto_id,
       COALESCE(SUM(l.cantidad), 0)                                   AS stock,
       MIN(CASE WHEN l.cantidad > 0 THEN l.fecha_caducidad END)      AS proxima_caducidad,
       COALESCE(SUM(CASE WHEN l.cantidad > 0 THEN 1 ELSE 0 END), 0)  AS lotes
FROM productos p
LEFT JOIN lotes l ON l.producto_id = p.id
GROUP BY p.id;
