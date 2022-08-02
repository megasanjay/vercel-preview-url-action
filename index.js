const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require('@octokit/action');

const cancelAction = async () => {
    if (core.getInput('GITHUB_TOKEN')) {
        const octokit = new Octokit();

        await octokit.actions.cancelWorkflowRun({
            ...github.context.repo,
            run_id: github.context.runId,
        });

        // Wait a maximum of 1 minute for the action to be cancelled.
        await new Promise(resolve => setTimeout(resolve, 60000));
    }

    // If no GitHub token or timeout has passed, fail action.
    process.exit(1);
};

const runAction = async () => {
    const { payload } = github.context;
    const { comment } = payload;

    if (!comment) {
        console.log('Action triggered on non-comment event.');
        await cancelAction();
    }

    const vercel_bot_name = core.getInput('vercel_bot_name');

    if (comment.user.login !== vercel_bot_name) {
        console.log('Comment did not originate from Vercel bot.', {
            vercel_bot_name,
        });
        await cancelAction();
    }

    const cancel_on_strings = core.getInput('cancel_on_strings').split(',');

    if (cancel_on_strings.some(word => comment.body.includes(word))) {
        console.log('Comment contained a word that should cancel the action.', {
            cancel_on_strings,
            comment: comment.body,
        });
        await cancelAction();
    }

    const matchFound = comment.body.search('Visit Preview');

    if (matchFound === -1) {
        console.log("Unable to find a preview URL in comment's body.", {
            comment: comment.body,
        });
        await cancelAction();
    }

    const restOfString = comment.body.substring(matchFound + 14);
    const endingBracket = restOfString.indexOf(')');

    const vercel_preview_url = restOfString.substring(0, endingBracket);

    if (vercel_preview_url) {
        console.log('Found preview URL.', { vercel_preview_url });
        core.setOutput('vercel_preview_url', vercel_preview_url);
        process.exit(0);
    } else {
        console.log('No preview URL found in comment body. Cancelling action.');
        await cancelAction();
    }
};

runAction();
