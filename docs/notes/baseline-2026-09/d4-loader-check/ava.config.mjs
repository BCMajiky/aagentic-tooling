// As run for the "with loader" rows. The "no loader" rows drop nodeArguments.
export default {
  files: ['d4-loader-check/*.test.js'],
  nodeArguments: ['--loader=ts-blank-space/register', '--no-warnings'],
  timeout: '5m',
};
