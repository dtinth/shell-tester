const { ShellTester } = require('./lib')

const tester = new ShellTester({
  shellCommand: 'bash --noprofile --norc',
})

tester.session('example', async (s) => {
  await s.expect('$')
  await s.send('ls\r')
  await s.expect('package.json')
})

tester.run()
