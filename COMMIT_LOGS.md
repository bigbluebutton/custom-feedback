## Commit message guidelines

- Commit message titles should be structured with conventional-commits: https://www.conventionalcommits.org/en/v1.0.0/
- Cap commit log lines at 72 characters
- Be succinct, direct. Prioritize TERSENESS. Information does not mean more words, but few useful words. A commit should be hard to summarize because it's already information-dense.
- Do not write transient information in the commit message. It must state what's
visible, the final state - and not long defunct in-progress artifacts.

### Detailed guidelines - IMPORTANT

- Meaningful message
```
The body should provide a meaningful commit message, which:
. explains the problem the change tries to solve, i.e. what is wrong
  with the current code without the change.
. justifies the way the change solves the problem, i.e. why the
  result with the change is better.
. alternate solutions considered but discarded, if any.
```
- Make separate commits for logically separate changes
```
Unless your patch is really trivial, you should not be sending
out a patch that was generated between your working tree and
your commit head.  Instead, always make a commit with complete
commit message and generate a series of patches from your
repository.  It is a good discipline.

Give an explanation for the change(s) that is detailed enough so
that people can judge if it is good thing to do, without reading
the actual patch text to determine how well the code does what
the explanation promises to do.

If your description starts to get too long, that's a sign that you
probably need to split up your commit to finer grained pieces.
That being said, patches which plainly describe the things that
help reviewers check the patch, and future maintainers understand
the code, are the most beautiful patches.  Descriptions that summarize
the point in the subject well, and describe the motivation for the
change, the approach taken by the change, and if relevant how this
differs substantially from the prior version, are all good things
to have.
```
- Present tense
```
The problem statement that describes the status quo is written in the
present tense.  Write "The code does X when it is given input Y",
instead of "The code used to do Y when given input X".  You do not
have to say "Currently"---the status quo in the problem statement is
about the code _without_ your change, by project convention.
```
- Imperative mood
```
Describe your changes in imperative mood, e.g. "make xyzzy do frotz"
instead of "[This patch] makes xyzzy do frotz" or "[I] changed xyzzy
to do frotz", as if you are giving orders to the codebase to change
its behavior.  Try to make sure your explanation can be understood
without external resources. Instead of giving a URL to a mailing list
archive, summarize the relevant points of the discussion.
```
