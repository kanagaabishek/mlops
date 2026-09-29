/**
 * Vehicle Mileage & Running Cost Prediction System
 * Monochrome Client Controller (INR Currency, Petrol/Diesel, Ethanol Blends)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const presetSelect = document.getElementById('car-preset-select');
  const fuelTypeSelect = document.getElementById('fuel-type-select');
  const ethanolSelect = document.getElementById('ethanol-select');
  const ethanolGroup = document.getElementById('ethanol-group');
  const ethanolBadge = document.getElementById('ethanol-badge');
  const cylindersSelect = document.getElementById('cylinders-select');
  const originSelect = document.getElementById('origin-select');
  const modelYearSelect = document.getElementById('model-year-select');

  const hpInput = document.getElementById('horsepower-input');
  const hpRange = document.getElementById('horsepower-range');
  const hpDisplay = document.getElementById('horsepower-display');

  const weightInput = document.getElementById('weight-input');
  const weightRange = document.getElementById('weight-range');
  const weightDisplay = document.getElementById('weight-display');

  const accelInput = document.getElementById('acceleration-input');
  const accelRange = document.getElementById('acceleration-range');
  const accelDisplay = document.getElementById('acceleration-display');

  const annualDistanceInput = document.getElementById('annual-distance');
  const fuelPriceInput = document.getElementById('fuel-price');

  const form = document.getElementById('prediction-form');
  const resetBtn = document.getElementById('reset-btn');
  const predictBtn = document.getElementById('predict-btn');

  // Results elements
  const kmlValueEl = document.getElementById('kml-value');
  const mpgValueEl = document.getElementById('mpg-value');
  const l100ValueEl = document.getElementById('l100-value');
  const diffValueEl = document.getElementById('diff-value');
  const fuelDescLabel = document.getElementById('fuel-desc-label');
  const gradeBadgeEl = document.getElementById('grade-badge');
  const gradeLetterEl = document.getElementById('grade-letter');
  const gradeLabelEl = document.getElementById('grade-label');
  const gaugeCircle = document.getElementById('gauge-circle');

  const costPerKmEl = document.getElementById('cost-per-km');
  const monthlyCostEl = document.getElementById('monthly-cost');
  const annualCostEl = document.getElementById('annual-cost');

  const historyBody = document.getElementById('history-body');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  let sessionHistory = [];
  let availableCars = [];
  let currentKML = 0;

  // Dropdown change listeners for instant recalculation
  modelYearSelect.addEventListener('change', () => {
    performPrediction('Custom Configuration');
  });

  cylindersSelect.addEventListener('change', () => {
    performPrediction('Custom Configuration');
  });

  originSelect.addEventListener('change', () => {
    performPrediction('Custom Configuration');
  });

  // 2. Fuel Type and Ethanol Blend Dynamics
  fuelTypeSelect.addEventListener('change', (e) => {
    const isDiesel = e.target.value === 'diesel';
    if (isDiesel) {
      ethanolSelect.disabled = true;
      ethanolBadge.textContent = 'Not Applicable (Diesel)';
      if (fuelPriceInput.value === '102.50') {
        fuelPriceInput.value = '90.00';
      }
    } else {
      ethanolSelect.disabled = false;
      ethanolBadge.textContent = ethanolSelect.value === 'E0' ? 'Pure Petrol' : ethanolSelect.value === 'E20' ? 'Modern 20% Blend' : 'Standard E10';
      if (fuelPriceInput.value === '90.00') {
        fuelPriceInput.value = '102.50';
      }
    }
    updateFuelDescriptionLabel();
    performPrediction('Custom Configuration');
  });

  ethanolSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    ethanolBadge.textContent = val === 'E0' ? 'Pure Petrol' : val === 'E20' ? 'Modern 20% Blend' : 'Standard E10';
    updateFuelDescriptionLabel();
    performPrediction('Custom Configuration');
  });

  function updateFuelDescriptionLabel() {
    const fuel = fuelTypeSelect.value.toUpperCase();
    if (fuel === 'DIESEL') {
      fuelDescLabel.textContent = 'Estimated Output for Diesel Engine';
    } else {
      const blend = ethanolSelect.value;
      fuelDescLabel.textContent = `Estimated Output for Petrol (${blend} Blend)`;
    }
  }

  // 3. Sync Dual Range + Number Controls
  function setupDualControl(rangeEl, inputEl, displayEl, formatFn) {
    function update(val) {
      val = parseFloat(val);
      rangeEl.value = val;
      inputEl.value = val;
      if (displayEl) {
        displayEl.textContent = formatFn(val);
      }
    }

    rangeEl.addEventListener('input', (e) => update(e.target.value));
    inputEl.addEventListener('input', (e) => update(e.target.value));
    update(inputEl.value);
  }

  setupDualControl(hpRange, hpInput, hpDisplay, (v) => `${v} BHP`);
  setupDualControl(weightRange, weightInput, weightDisplay, (v) => `${v} lbs (~${Math.round(v * 0.453592)} kg)`);
  setupDualControl(accelRange, accelInput, accelDisplay, (v) => `${v} s`);

  // 4. Fetch Presets & Stats on Load
  async function loadInitialData() {
    try {
      const resCars = await fetch('/api/cars');
      if (resCars.ok) {
        const data = await resCars.json();
        availableCars = data.cars || [];
        populatePresetsDropdown(availableCars);
      }

      const resStats = await fetch('/api/stats');
      if (resStats.ok) {
        const stats = await resStats.json();
        if (stats.avg_kml) {
          document.getElementById('stat-avg-kml').textContent = `${stats.avg_kml} km/L`;
        }
      }
    } catch (err) {
      console.warn('Data load warning:', err);
    }
  }

  function populatePresetsDropdown(cars) {
    presetSelect.innerHTML = '<option value="">-- Choose Car from Database (Auto-Fill) --</option>';
    cars.forEach((car, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      const originName = car.origin === 1 ? 'USA' : car.origin === 2 ? 'Europe' : 'Asia';
      opt.textContent = `${capitalizeWords(car['car name'])} (19${car['model year']}, ${car.cylinders} Cyl, ${car.horsepower} HP, ${originName})`;
      presetSelect.appendChild(opt);
    });
  }

  function capitalizeWords(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
  }

  // 5. Preset Car Selected
  presetSelect.addEventListener('change', (e) => {
    const idx = e.target.value;
    if (idx === '' || !availableCars[idx]) return;

    const car = availableCars[idx];
    cylindersSelect.value = car.cylinders;
    originSelect.value = car.origin;

    const carFullYear = 1900 + car['model year'];
    modelYearSelect.value = carFullYear;

    hpInput.value = car.horsepower;
    hpRange.value = car.horsepower;
    hpDisplay.textContent = `${car.horsepower} BHP`;

    weightInput.value = car.weight;
    weightRange.value = car.weight;
    weightDisplay.textContent = `${car.weight} lbs (~${Math.round(car.weight * 0.453592)} kg)`;

    accelInput.value = car.acceleration;
    accelRange.value = car.acceleration;
    accelDisplay.textContent = `${car.acceleration} s`;

    performPrediction(car['car name']);
  });

  // 6. Form Submission & Prediction Handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const presetName = presetSelect.selectedIndex > 0 ? availableCars[presetSelect.value]?.['car name'] : 'Custom Configuration';
    performPrediction(presetName);
  });

  async function performPrediction(vehicleName = 'Custom Vehicle') {
    predictBtn.disabled = true;
    predictBtn.textContent = 'Computing...';

    const payload = {
      cylinders: parseInt(cylindersSelect.value),
      horsepower: parseFloat(hpInput.value),
      weight: parseFloat(weightInput.value),
      acceleration: parseFloat(accelInput.value),
      model_year: parseInt(modelYearSelect.value),
      origin: parseInt(originSelect.value),
      fuel_type: fuelTypeSelect.value,
      ethanol_blend: ethanolSelect.value,
      annual_distance_km: parseFloat(annualDistanceInput.value) || 15000,
      fuel_price_inr: parseFloat(fuelPriceInput.value) || 102.50
    };

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server status ${response.status}`);
      }

      const data = await response.json();
      displayPredictionResults(data);
      addToHistory(vehicleName, payload, data);
    } catch (err) {
      console.warn('Prediction request fallback:', err);
      const fallbackKML = estimateFallbackKML(payload);
      const fallbackData = {
        predicted_kml: fallbackKML,
        predicted_mpg: round(fallbackKML * 2.35215, 2),
        liters_per_100km: round(100 / fallbackKML, 2),
        rating: getFallbackRating(fallbackKML),
        cost_per_km_inr: round(payload.fuel_price_inr / fallbackKML, 2),
        monthly_fuel_cost_inr: round(((payload.annual_distance_km / fallbackKML) * payload.fuel_price_inr) / 12, 2),
        annual_fuel_cost_inr: round((payload.annual_distance_km / fallbackKML) * payload.fuel_price_inr, 2),
        fuel_details: {
          fuel_type: payload.fuel_type.toUpperCase(),
          ethanol_blend: payload.fuel_type === 'diesel' ? 'N/A' : payload.ethanol_blend
        },
        comparison: {
          baseline_avg_kml: 9.97,
          diff_from_avg: round(fallbackKML - 9.97, 2),
          diff_percentage: round(((fallbackKML - 9.97) / 9.97) * 100, 1),
          is_better_than_avg: fallbackKML >= 9.97
        }
      };
      displayPredictionResults(fallbackData);
      addToHistory(vehicleName, payload, fallbackData);
    } finally {
      predictBtn.disabled = false;
      predictBtn.textContent = 'Compute Mileage';
    }
  }

  function displayPredictionResults(data) {
    const targetKML = data.predicted_kml;

    // Animate Primary km/L Count-up
    animateValue(kmlValueEl, currentKML, targetKML, 600);
    currentKML = targetKML;

    // Gauge Arc (Max scale ~ 25 km/L)
    const maxScaleKML = 24.0;
    const progressFraction = Math.min(1.0, Math.max(0.0, targetKML / maxScaleKML));
    const circumference = 502;
    const offset = circumference - (circumference * progressFraction * 0.75);
    gaugeCircle.style.strokeDashoffset = offset;

    // Rating
    if (data.rating) {
      gradeLetterEl.textContent = data.rating.grade;
      gradeLabelEl.textContent = data.rating.label;
    }

    // Conversions
    mpgValueEl.textContent = `${data.predicted_mpg} MPG`;
    l100ValueEl.textContent = `${data.liters_per_100km} L/100km`;

    // Baseline Comparison
    if (data.comparison) {
      const sign = data.comparison.diff_from_avg >= 0 ? '+' : '';
      diffValueEl.textContent = `${sign}${data.comparison.diff_from_avg} km/L (${sign}${data.comparison.diff_percentage}%)`;
    }

    // Financial Metrics in Rupees (₹)
    costPerKmEl.textContent = `₹ ${data.cost_per_km_inr.toFixed(2)} / km`;
    monthlyCostEl.textContent = `₹ ${Math.round(data.monthly_fuel_cost_inr).toLocaleString('en-IN')}`;
    annualCostEl.textContent = `₹ ${Math.round(data.annual_fuel_cost_inr).toLocaleString('en-IN')}`;
  }

  function animateValue(element, start, end, duration) {
    const startTime = performance.now();
    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const val = (start + (end - start) * progress).toFixed(1);
      element.textContent = val;
      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        element.textContent = end.toFixed(1);
      }
    }
    requestAnimationFrame(step);
  }

  // 7. History & Comparison Log
  function addToHistory(name, specs, result) {
    const fuelLabel = specs.fuel_type === 'diesel' ? 'Diesel' : `Petrol (${specs.ethanol_blend})`;
    sessionHistory.unshift({
      name: capitalizeWords(name),
      fuel: fuelLabel,
      year: specs.model_year,
      cyl: specs.cylinders,
      hp: specs.horsepower,
      kml: result.predicted_kml,
      costPerKm: result.cost_per_km_inr
    });

    renderHistory();
  }

  function renderHistory() {
    if (sessionHistory.length === 0) {
      historyBody.innerHTML = '<tr class="empty-row"><td colspan="7">No test records yet. Select a car model or click Compute Mileage.</td></tr>';
      return;
    }

    historyBody.innerHTML = '';
    sessionHistory.slice(0, 10).forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; color: #FFF;">${item.name}</td>
        <td>${item.fuel}</td>
        <td>${item.year}</td>
        <td>${item.cyl}</td>
        <td>${item.hp}</td>
        <td style="font-weight: 700; color: #FFF;">${item.kml.toFixed(1)} km/L</td>
        <td>₹ ${item.costPerKm.toFixed(2)} / km</td>
      `;
      historyBody.appendChild(tr);
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    sessionHistory = [];
    renderHistory();
  });

  // 8. Reset Form
  resetBtn.addEventListener('click', () => {
    presetSelect.value = '';
    fuelTypeSelect.value = 'petrol';
    ethanolSelect.value = 'E10';
    ethanolSelect.disabled = false;
    ethanolBadge.textContent = 'Standard E10';
    cylindersSelect.value = '4';
    originSelect.value = '1';
    modelYearSelect.value = '2024';
    
    hpInput.value = 100;
    hpRange.value = 100;
    hpDisplay.textContent = '100 BHP';

    weightInput.value = 2800;
    weightRange.value = 2800;
    weightDisplay.textContent = '2800 lbs (~1270 kg)';

    accelInput.value = 15.5;
    accelRange.value = 15.5;
    accelDisplay.textContent = '15.5 s';

    fuelPriceInput.value = '102.50';
    annualDistanceInput.value = '15000';

    updateFuelDescriptionLabel();
    performPrediction('Standard 4-Cylinder Petrol');
  });

  function round(num, dec = 2) {
    return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
  }

  function estimateFallbackKML(p) {
    let baseMpg = 45.0 - (0.0055 * p.weight) - (0.045 * p.horsepower) - (0.8 * p.cylinders) + 9.0 + (1.2 * p.origin);
    if (p.model_year > 1982) {
      baseMpg *= (1.0 + Math.min(0.35, (p.model_year - 1982) * 0.007));
    }
    if (p.fuel_type === 'diesel') baseMpg *= 1.20;
    if (p.fuel_type === 'petrol' && p.ethanol_blend === 'E0') baseMpg *= 1.025;
    if (p.fuel_type === 'petrol' && p.ethanol_blend === 'E20') baseMpg *= 0.955;
    const kml = baseMpg * 0.425144;
    return Math.max(3.5, round(kml, 2));
  }

  function getFallbackRating(kml) {
    if (kml >= 16.0) return { grade: "A+", label: "Exceptional Efficiency" };
    if (kml >= 12.5) return { grade: "A", label: "High Efficiency" };
    if (kml >= 9.5) return { grade: "B", label: "Moderate Efficiency" };
    if (kml >= 7.0) return { grade: "C", label: "Standard Efficiency" };
    return { grade: "D", label: "High Consumption" };
  }

  // Initialize
  loadInitialData().then(() => {
    updateFuelDescriptionLabel();
    performPrediction('Standard 4-Cylinder Petrol');
  });
});
