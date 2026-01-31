
import { DataRow, ChartConfig } from '../types';

// Helper to calculate quartiles
const getQuantile = (array: number[], quantile: number) => {
    const sorted = [...array].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * quantile;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
};

export const processChartData = (data: DataRow[], config: ChartConfig) => {
  if (!data || data.length === 0 || !config.xAxisKey) return [];

  // Apply Feature Filtering First
  let filteredSource = data;
  if (config.columnFilters) {
    Object.entries(config.columnFilters).forEach(([col, selectedValues]) => {
      if (selectedValues && selectedValues.length > 0) {
        filteredSource = filteredSource.filter(row => {
          const val = row[col];
          return selectedValues.includes(val);
        });
      }
    });
  }

  // 1. HEATMAP & CONTOUR (2D Frequency)
  if (config.type === 'heatmap' || config.type === 'contour') {
    const xKey = config.xAxisKey;
    const yKey = config.yAxisKeys?.[0]; 
    if (!yKey) return []; 

    const aggMap = new Map<string, number>();
    filteredSource.forEach(row => {
        const xVal = String(row[xKey]);
        const yVal = String(row[yKey]);
        const key = `${xVal}###${yVal}`;
        aggMap.set(key, (aggMap.get(key) || 0) + 1);
    });

    const result = Array.from(aggMap.entries()).map(([key, value]) => {
        const [x, y] = key.split('###');
        return { x, y, value, z: value };
    });
    return result.slice(0, 500);
  }

  // 2. VENN DIAGRAM (Set Overlap)
  if (config.type === 'venn') {
      const setAKey = config.xAxisKey;
      const setBKey = config.yAxisKeys?.[0];
      if (!setBKey) return [];

      let countA = 0;
      let countB = 0;
      let intersection = 0;

      filteredSource.forEach(row => {
          const valA = row[setAKey];
          const valB = row[setBKey];
          const isA = valA !== null && valA !== false && valA !== 0 && valA !== '';
          const isB = valB !== null && valB !== false && valB !== 0 && valB !== '';
          if (isA && isB) intersection++;
          else if (isA) countA++;
          else if (isB) countB++;
      });

      return [
          { name: 'A', value: countA, label: setAKey },
          { name: 'B', value: countB, label: setBKey },
          { name: 'Intersection', value: intersection, label: 'Both' }
      ];
  }

  // 3. BOX PLOT (Distribution Stats)
  if (config.type === 'box') {
      const xKey = config.xAxisKey;
      const yKey = config.yAxisKeys?.[0];
      if (!yKey) return [];
      const groupedValues: Record<string, number[]> = {};

      filteredSource.forEach(row => {
          const group = String(row[xKey]);
          const val = Number(row[yKey]);
          if (!isNaN(val)) {
              if (!groupedValues[group]) groupedValues[group] = [];
              groupedValues[group].push(val);
          }
      });

      return Object.entries(groupedValues).map(([name, values]) => {
          if (values.length === 0) return null;
          const min = Math.min(...values);
          const max = Math.max(...values);
          const q1 = getQuantile(values, 0.25);
          const median = getQuantile(values, 0.5);
          const q3 = getQuantile(values, 0.75);
          return { name, min, q1, median, q3, max };
      }).filter(Boolean);
  }

  // 4. SCATTER & BUBBLE (Raw Data)
  if (config.type === 'scatter' || config.type === 'bubble') {
    return filteredSource
      .map(row => ({
        ...row,
        name: String(row[config.xAxisKey]),
        x: Number(row[config.xAxisKey]),
        y: Number(row[config.yAxisKeys?.[0] || '']),
        z: config.zAxisKey ? Math.abs(Number(row[config.zAxisKey])) : 100
      }))
      .filter(pt => !isNaN(pt.x) && !isNaN(pt.y))
      .slice(0, 1000);
  }

  // 5. AGGREGATION (Bar, Line, Area, Pie, Doughnut)
  const aggType = config.aggregation || 'sum';
  const groupedData: Record<string, any> = {};

  filteredSource.forEach(row => {
    const xValue = String(row[config.xAxisKey]);
    if (!groupedData[xValue]) {
      groupedData[xValue] = { name: xValue, _count: 0, _sums: {}, _mins: {}, _maxs: {} };
      config.yAxisKeys?.forEach(key => {
        groupedData[xValue]._sums[key] = 0;
        groupedData[xValue]._mins[key] = Infinity;
        groupedData[xValue]._maxs[key] = -Infinity;
      });
    }

    groupedData[xValue]._count += 1;
    config.yAxisKeys?.forEach(key => {
      const val = Number(row[key]);
      if (!isNaN(val)) {
        groupedData[xValue]._sums[key] += val;
        groupedData[xValue]._mins[key] = Math.min(groupedData[xValue]._mins[key], val);
        groupedData[xValue]._maxs[key] = Math.max(groupedData[xValue]._maxs[key], val);
      }
    });
  });

  let result = Object.values(groupedData).map(item => {
    const newItem: any = { name: item.name, _raw_count: item._count };
    if (!config.yAxisKeys || config.yAxisKeys.length === 0) {
      newItem.value = item._count;
    } else {
      config.yAxisKeys.forEach(key => {
        if (aggType === 'sum') newItem[key] = item._sums[key];
        else if (aggType === 'avg') newItem[key] = item._count > 0 ? Number((item._sums[key] / item._count).toFixed(2)) : 0;
        else if (aggType === 'min') newItem[key] = item._mins[key] === Infinity ? 0 : item._mins[key];
        else if (aggType === 'max') newItem[key] = item._maxs[key] === -Infinity ? 0 : item._maxs[key];
        else if (aggType === 'count') newItem[key] = item._count;
      });
    }
    return newItem;
  });

  // Sort Logic
  const sortBy = config.sortByValue || 'none';
  if (sortBy !== 'none') {
    const primaryKey = config.yAxisKeys?.[0] || 'value';
    result.sort((a, b) => {
      const valA = a[primaryKey] || 0;
      const valB = b[primaryKey] || 0;
      return sortBy === 'asc' ? valA - valB : valB - valA;
    });
  } else {
    // Default alphabetical/numerical sort by X-Axis name
    result.sort((a, b) => {
      const numA = parseFloat(a.name);
      const numB = parseFloat(b.name);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  return result.slice(0, 100);
};
