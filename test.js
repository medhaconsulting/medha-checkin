const { haversineMeters, isWithinRadius, CONFIG } = require("./app.js");
const assert = require("assert");
const d0 = haversineMeters(CONFIG.officeLat, CONFIG.officeLng, CONFIG.officeLat, CONFIG.officeLng);
assert(d0 < 1); console.log("PASS office point distance =", d0, "m");
const lat1k = CONFIG.officeLat + 0.009; // ~1 km north
const d1 = haversineMeters(lat1k, CONFIG.officeLng, CONFIG.officeLat, CONFIG.officeLng);
assert(d1 > 950 && d1 < 1050); assert(!isWithinRadius(lat1k, CONFIG.officeLng));
console.log("PASS ~1 km point distance =", d1.toFixed(1), "m, rejected");
const d50 = CONFIG.officeLat + 0.00045; assert(isWithinRadius(d50, CONFIG.officeLng));
console.log("PASS ~50 m point accepted");
