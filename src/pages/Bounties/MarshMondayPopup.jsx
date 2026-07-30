import React from 'react';
import './MarshMondayPopup.css';

import { usePokemonSprites } from '../../hooks/usePokemonSprites';
import { translatePokemonName } from '../../utils/pokemon';

function PokemonGif({ name }) {
  const sprites = usePokemonSprites(name);
  let gifUrl = null;
  if (sprites['generation-v']) {
    const genVSprites = sprites['generation-v'];
    const gif = genVSprites.find(s => s.type === 'gif' && s.url);
    if (gif) gifUrl = gif.url;
  }
  if (!gifUrl) {
    for (const gen of Object.keys(sprites)) {
      const sprite = sprites[gen].find(s => s.url);
      if (sprite) {
        gifUrl = sprite.url;
        break;
      }
    }
  }
  if (!gifUrl) return null;
  return <img className="marsh-monday-pokemon-sprite" src={gifUrl} alt={translatePokemonName(name)} title={translatePokemonName(name)} />;
}

export default function MarshMondayPopup() {
  return (
    <div className="marsh-monday-popup" role="status" aria-live="polite">
      <div className="marsh-monday-popup-title">猛火猴湿原星期一</div>
      <div className="marsh-monday-popup-desc">
        每周一在大湿原捕获一只闪光宝可梦，即可获得 1000 RP！别忘了带上你的猛火猴跟随宝可梦！
      </div>
      <div className="marsh-monday-pokemon-row">
        <PokemonGif name="skorupi" />
        <PokemonGif name="carnivine" />
        <PokemonGif name="croagunk" />
      </div>
    </div>
  );
}
