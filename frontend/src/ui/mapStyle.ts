/** Google Maps JSON style — a warm dark theme matching the app's espresso
 * palette, in the spirit of Citymapper / TfL Go / Apple Maps' dark mode. */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#211B17' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#928374' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#211B17' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#D2C2AB' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2B3026' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#332B26' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7A6F63' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3D332D' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#332B26' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#26333A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5C6F78' }] },
];
