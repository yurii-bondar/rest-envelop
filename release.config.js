module.exports = {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    '@semantic-release/npm',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          {
            path: 'dist/*.js',
            label: 'Distribution Files',
          },
        ],
      },
    ],
  ],
  tagFormat: '${version}',
};
