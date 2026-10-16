export const DEFAULT_RESOURCE_IMAGE = "/images/collaboratory_logo.jpg";

export const resourceImages = {
  "machine-1": "/images/3d_printer.jpg",
  "machine-2": "/images/laser_engraver.jpg",
  "machine-4": "/images/wood_lathe.png",
  "machine-5": "/images/methal_lathe.jpg",
  "machine-6": "/images/large_cnc.jpg",
  "machine-7": "/images/small_cnc.png",
};

export function getResourceImage(resourceId) {
  return resourceImages[resourceId] || DEFAULT_RESOURCE_IMAGE;
}
