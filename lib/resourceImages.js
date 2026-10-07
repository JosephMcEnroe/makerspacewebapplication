export const DEFAULT_RESOURCE_IMAGE = "/images/Collaboratory Logo.jpg";

export const resourceImages = {
  "machine-1": "/images/3Dprinter.jpg",
  "machine-2": "/images/laser_engraver.jpg",
  "machine-4": "/images/wood_lathe.png",
  "machine-5": "/images/methal lathe.jpg",
  "machine-6": "/images/large_cnc.jpg",
};

export function getResourceImage(resourceId) {
  return resourceImages[resourceId] || DEFAULT_RESOURCE_IMAGE;
}
