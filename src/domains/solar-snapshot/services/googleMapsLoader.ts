import { setOptions } from '@googlemaps/js-api-loader';

let configuredKey = '';

export function configureGoogleMapsLoader(apiKey: string) {
  if (configuredKey) return;
  setOptions({ key: apiKey, v: 'weekly', libraries: ['places', 'marker'] });
  configuredKey = apiKey;
}
