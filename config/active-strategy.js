let lastSide = 'SELL';

function evaluate(data) {
    const price = data.close || data.price;

    // === CONFIG ===
    const balance = 100;        // capital base (USDT)
    const leverage = 10;        // 10x
    const risk_pct = 0.10;      // usa 10% del capital por trade

    const sl_pct = 0.001;       // 0.1% (más amplio que ultra sensible)
    const tp_pct = 0.002;       // 0.2%

    // === tamaño de posición ===
    const position_value = balance * risk_pct * leverage; // exposición total
    const size = position_value / price; // cantidad en BTC

    let side, stopLoss, takeProfit;

    if (lastSide === 'SELL') {
        side = 'BUY';

        stopLoss = price * (1 - sl_pct);
        takeProfit = price * (1 + tp_pct);

        lastSide = 'BUY';
    } else {
        side = 'SELL';

        stopLoss = price * (1 + sl_pct);
        takeProfit = price * (1 - tp_pct);

        lastSide = 'SELL';
    }

    return {
        action: side,
        size: size,
        leverage: leverage,
        stopLoss: stopLoss,
        takeProfit: takeProfit
    };
}

module.exports = { evaluate };