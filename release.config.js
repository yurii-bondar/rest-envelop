module.exports = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
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
        // eslint-disable-next-line no-template-curly-in-string
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
  // eslint-disable-next-line no-template-curly-in-string
  tagFormat: '${version}',
};
