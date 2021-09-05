const { ShellTester } = require('./lib')

const tester = new ShellTester({
  shellCommand: 'bash --noprofile --norc',
})

tester.session('example', async (s) => {
  await s.resize(80, 12)

  await s.expect('$')
  await s.send('ls\r')
  await s.expect('package.json')

  await s.expect('$')

  // Repeatedly send Ctrl+R until we get a prompt
  await s.retry(async () => {
    await s.send('\x12') // Ctrl+R - reverse-i-search
    await s.expect('reverse-i', 100)
  }, 3000)

  await s.send('l')
  await s.expect('ls')
  await s.capture('reverse-i-search')

  await s.send('\05') // Ctrl+E - go to end-of-line
  await s.send(' -l\r')
  await s.expect('drwx')
  await s.capture('example')
})

tester.run()
