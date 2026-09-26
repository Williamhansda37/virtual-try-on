-- Cloudflare D1 Relational Schema for 3D Virtual Try-On Asset Catalog

DROP TABLE IF EXISTS anchor_calibrations;
DROP TABLE IF EXISTS model_assets;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  landmark_tracker_type TEXT NOT NULL DEFAULT 'face' -- 'face', 'pose', 'hands'
);

INSERT INTO categories (id, name, description, landmark_tracker_type) VALUES
('eyewear', 'Eyewear & Sunglasses', 'Glasses, sunglasses, frames anchored to nose-bridge and eye corners', 'face'),
('hat', 'Hats & Headwear', 'Caps, beanies, head accessories anchored to forehead & temples', 'face'),
('watch', 'Watches & Wristbands', 'Watches and bracelets anchored to wrist and forearm pose landmarks', 'pose'),
('jewelry', 'Earrings & Necklaces', 'Earrings, pendants, chains anchored to ears and clavicle', 'face');

CREATE TABLE model_assets (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  model_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  poly_count INTEGER NOT NULL,
  default_scale_x REAL DEFAULT 1.0,
  default_scale_y REAL DEFAULT 1.0,
  default_scale_z REAL DEFAULT 1.0,
  bone_anchors_json TEXT NOT NULL, -- JSON array of bone anchors
  materials_json TEXT,
  version TEXT DEFAULT '1.0.0',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE anchor_calibrations (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  interpupillary_dist_mm REAL DEFAULT 63.0,
  smoothing_factor REAL DEFAULT 0.35,
  camera_fov REAL DEFAULT 60.0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
