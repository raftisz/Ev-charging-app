-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "imageUrl" TEXT;

-- Give the existing stations their photos, matched by name. Only rows with
-- no photo yet are touched, so re-running this or a station whose photo was
-- changed by hand is left alone, and stations with other names stay NULL
-- (the UI shows a gradient for those).
UPDATE "Station" AS s
SET "imageUrl" = v.url
FROM (VALUES
    ('Sukhumvit Supercharge Hub', '/stations/sukhumvit-supercharge-hub.webp'),
    ('Siam Green Station', '/stations/siam-green-station.webp'),
    ('Riverside EV Point', '/stations/riverside-ev-point.webp'),
    ('Central Park Charging Bay', '/stations/central-park-charging-bay.webp'),
    ('Northline Fast Charge', '/stations/northline-fast-charge.webp'),
    ('Sathorn Business Hub', '/stations/sathorn-business-hub.webp'),
    ('Chatuchak Charge & Go', '/stations/chatuchak-charge-and-go.webp'),
    ('Rama IX Power Station', '/stations/rama-ix-power-station.webp'),
    ('Ekkamai Urban Charger', '/stations/ekkamai-urban-charger.webp'),
    ('Bang Na Highway Stop', '/stations/bang-na-highway-stop.webp'),
    ('Ratchada Night Charge', '/stations/ratchada-night-charge.webp'),
    ('Ari Neighborhood Station', '/stations/ari-neighborhood-station.webp'),
    ('Thonglor Premium Charge', '/stations/thonglor-premium-charge.webp'),
    ('Phrom Phong Skyline Hub', '/stations/phrom-phong-skyline-hub.webp'),
    ('Ladprao Community Charger', '/stations/ladprao-community-charger.webp'),
    ('Silom District Point', '/stations/silom-district-point.webp'),
    ('Asoke Intersection Hub', '/stations/asoke-intersection-hub.webp'),
    ('Bangna Trad Express', '/stations/bangna-trad-express.webp'),
    ('Onnut Local Charger', '/stations/onnut-local-charger.webp'),
    ('Suvarnabhumi Airport Hub', '/stations/suvarnabhumi-airport-hub.webp')
) AS v(name, url)
WHERE s."name" = v.name AND s."imageUrl" IS NULL;
