const webpack = require('webpack');

module.exports = function override(config, env) {
  // Добавляем полифил для 'buffer'
  config.resolve.fallback = {
    ...config.resolve.fallback,
    buffer: require.resolve('buffer/'),
    stream: require.resolve('stream-browserify'),
  };

  // Добавляем плагин для предоставления глобальных переменных для 'buffer'
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ]);

  return config;
};
