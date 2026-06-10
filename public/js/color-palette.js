/**
 * Color Palette Filter System
 * Production-ready, modular, multi-select color filter for product listings
 */

const ColorPalette = (() => {
  // Predefined saree-relevant color palette (curated for Indian ethnic wear)
  const PALETTE = [
    { name: 'Red', hex: '#D32F2F' },
    { name: 'Dark Red', hex: '#8B0000' },
    { name: 'Maroon', hex: '#800020' },
    { name: 'Wine', hex: '#722F37' },
    { name: 'Pink', hex: '#E91E8C' },
    { name: 'Light Pink', hex: '#F8BBD0' },
    { name: 'Baby Pink', hex: '#FFC1CC' },
    { name: 'Magenta', hex: '#C2185B' },
    { name: 'Rani Pink', hex: '#E4007C' },
    { name: 'Orange', hex: '#E65100' },
    { name: 'Light Orange', hex: '#FFB74D' },
    { name: 'Peach', hex: '#FFAB91' },
    { name: 'Coral', hex: '#FF7043' },
    { name: 'Rust', hex: '#A0522D' },
    { name: 'Yellow', hex: '#F9A825' },
    { name: 'Light Yellow', hex: '#FFF59D' },
    { name: 'Mustard', hex: '#C6951C' },
    { name: 'Gold', hex: '#B8860B' },
    { name: 'Dark Gold', hex: '#8B6914' },
    { name: 'Green', hex: '#2E7D32' },
    { name: 'Light Green', hex: '#81C784' },
    { name: 'Mint', hex: '#A5D6A7' },
    { name: 'Olive', hex: '#6B8E23' },
    { name: 'Dark Green', hex: '#1B5E20' },
    { name: 'Teal', hex: '#00897B' },
    { name: 'Turquoise', hex: '#26C6DA' },
    { name: 'Sky Blue', hex: '#64B5F6' },
    { name: 'Blue', hex: '#1565C0' },
    { name: 'Royal Blue', hex: '#1A237E' },
    { name: 'Navy', hex: '#0D1B3E' },
    { name: 'Purple', hex: '#6A1B9A' },
    { name: 'Light Purple', hex: '#BA68C8' },
    { name: 'Lavender', hex: '#B39DDB' },
    { name: 'Violet', hex: '#4A148C' },
    { name: 'Brown', hex: '#5D4037' },
    { name: 'Light Brown', hex: '#A1887F' },
    { name: 'Chocolate', hex: '#3E2723' },
    { name: 'Copper', hex: '#B87333' },
    { name: 'Beige', hex: '#D7CCC8' },
    { name: 'Cream', hex: '#FFF8E1' },
    { name: 'Ivory', hex: '#FFFFF0' },
    { name: 'Off White', hex: '#FAF0E6' },
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Silver', hex: '#C0C0C0' },
    { name: 'Grey', hex: '#757575' },
    { name: 'Dark Grey', hex: '#424242' },
    { name: 'Black', hex: '#212121' },
  ];

  let selectedColors = [];
  let onFilterChange = null;
  let containerEl = null;

  function init(container, callback) {
    containerEl = typeof container === 'string' ? document.getElementById(container) : container;
    onFilterChange = callback;
    render();
  }

  function render() {
    if (!containerEl) return;

    const hasSelection = selectedColors.length > 0;

    containerEl.innerHTML = `
      <div class="color-filter-bar">
        <div class="color-filter-header">
          <span class="color-filter-label">Filter by Color</span>
          ${hasSelection ? `<button class="color-clear-btn" onclick="ColorPalette.clearAll()">Clear All <span class="clear-count">${selectedColors.length}</span></button>` : ''}
        </div>
        <div class="color-swatches">
          ${PALETTE.map(c => {
            const isActive = selectedColors.includes(c.hex);
            const needsBorder = ['#FAFAFA', '#FFF8E1', '#D7CCC8', '#FFAB91'].includes(c.hex);
            return `
              <button 
                class="color-swatch ${isActive ? 'active' : ''}" 
                style="background:${c.hex};${needsBorder ? 'box-shadow:inset 0 0 0 1px rgba(0,0,0,0.15);' : ''}"
                onclick="ColorPalette.toggle('${c.hex}')"
                title="${c.name}"
                aria-label="Filter by ${c.name}"
              >
                ${isActive ? '<i class="fas fa-check"></i>' : ''}
                <span class="swatch-tooltip">${c.name}</span>
              </button>
            `;
          }).join('')}
        </div>
        ${hasSelection ? `
          <div class="color-active-tags">
            ${selectedColors.map(hex => {
              const color = PALETTE.find(c => c.hex === hex);
              return `<span class="color-tag" style="border-color:${hex};">
                <span class="color-tag-dot" style="background:${hex};"></span>
                ${color ? color.name : hex}
                <button onclick="ColorPalette.remove('${hex}')">&times;</button>
              </span>`;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  function toggle(hex) {
    const index = selectedColors.indexOf(hex);
    if (index > -1) {
      selectedColors.splice(index, 1);
    } else {
      selectedColors.push(hex);
    }
    render();
    emitChange();
  }

  function remove(hex) {
    selectedColors = selectedColors.filter(c => c !== hex);
    render();
    emitChange();
  }

  function clearAll() {
    selectedColors = [];
    render();
    emitChange();
  }

  function emitChange() {
    if (onFilterChange) onFilterChange(selectedColors);
  }

  function getSelected() {
    return [...selectedColors];
  }

  function getPalette() {
    return [...PALETTE];
  }

  // Public API
  return { init, toggle, remove, clearAll, getSelected, getPalette, PALETTE };
})();
