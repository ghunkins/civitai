import {
  ActionIcon,
  Button,
  Card,
  Container,
  Group,
  Stack,
  Title,
  Text,
  Select,
  Alert,
  Input,
  TextInput,
  NumberInput,
  Box,
  Progress,
  BoxProps,
  MantineColor,
  ThemeIcon,
  ThemeIconProps,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconBrush,
  IconCheck,
  IconHeartFilled,
  IconPlayerPlayFilled,
  IconPlayerStop,
  IconPlayerStopFilled,
  IconPlus,
  IconSend,
  IconThumbDownFilled,
  IconThumbUpFilled,
  IconX,
} from '@tabler/icons-react';
import React, { useState, useEffect, DragEvent, useRef } from 'react';
import { useBuzzTransaction } from '~/components/Buzz/buzz.utils';
import { BuzzTransactionButton } from '~/components/Buzz/BuzzTransactionButton';
import {
  GameState,
  GlobalState,
  JoinGame,
  Judge,
  NewGame,
  RoundStatus,
  Submission,
  Theme,
} from '~/components/Chopped/chopped.shared-types';
import {
  ComputeCost,
  dummyImage,
  useChoppedStore,
  useChoppedUserId,
  useIsHost,
} from '~/components/Chopped/chopped.utils';
import { EdgeMedia } from '~/components/EdgeMedia/EdgeMedia';
import { getRandom, shuffle } from '~/utils/array-helpers';
import { getRandomInt, numberWithCommas } from '~/utils/number-helpers';
import { trpc } from '~/utils/trpc';
import { useBase64Audio } from '~/server/utils/audio-utils';
import {
  ChoppedJudgeReaction,
  ChoppedUserSubmission,
  ChoppedLayout,
  ChoppedJudgeComment,
  ChoppedRetryButton,
} from '~/components/Chopped/chopped.components';
import { useChoppedServer } from '~/components/Chopped/chopped.connection';
import { generationPanel } from '~/store/generation.store';
import { parseAIR } from '~/utils/string-helpers';
import { Dropzone, DropzoneProps } from '@mantine/dropzone';
import { IMAGE_MIME_TYPE } from '~/server/common/mime-types';
import { fetchBlob, getBase64 } from '~/utils/file-utils';
import { resizeImage } from '~/utils/image-utils';

export function Playing() {
  const roundNumber = useChoppedStore((state) => state.game!.round + 1);
  const roundStatus = useChoppedStore(
    (state) => state.game!.rounds[state.game!.round.toString()].status
  );
  const theme = useChoppedStore((state) => {
    const round = state.game!.rounds[state.game!.round.toString()];
    return state.global.themes.find((theme) => theme.id === round.themeId)!;
  });

  const StateComponent = roundStates[roundStatus];
  if (!StateComponent) return null;

  return (
    <ChoppedLayout
      title={
        <Title align="center">
          Round {roundNumber}: {theme.name}
        </Title>
      }
      canCreate
    >
      <StateComponent theme={theme} roundNumber={roundNumber} />
    </ChoppedLayout>
  );
}

type RoundProps = {
  theme: Theme;
  roundNumber: number;
};
function RoundPending({ theme, roundNumber }: RoundProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isHost = useIsHost();
  const server = useChoppedServer();
  const gameCode = useChoppedStore((state) => state.game!.code);
  const users = useChoppedStore((state) => state.game?.users ?? []);
  const startRound = isHost
    ? async () => {
        console.log('Starting round', roundNumber);
        server.continueGame();
      }
    : undefined;

  // TODO.chopped - back button here?

  return (
    <Stack>
      {roundNumber === 1 && (
        <Alert className="self-center">
          <Group position="apart">
            <Text size={40}>🎉</Text>
            <Stack align="center" spacing={0}>
              <Text>Invite others to join!</Text>
              <Text className="uppercase font-bold text-xl">{gameCode}</Text>
            </Stack>
            <Text size={40}>🎉</Text>
          </Group>
        </Alert>
      )}
      <div
        className="relative flex flex-col justify-center items-center"
        style={{ minHeight: 400 }}
      >
        <Text
          className="absolute top-1/2 -ml-2 -mt-2 -translate-y-1/2 text-8xl font-extrabold uppercase tracking-widest text-white text-center opacity-0 transition-opacity duration-500 ease-in-out"
          size={48}
          weight="bold"
          style={{
            opacity: imageLoaded ? 1 : 0,
            textShadow:
              '4px 4px 0 #3b82f6, 8px 8px 0 #2563eb, 12px 12px 0 #1d4ed8, 16px 16px 0 #1e40af, 20px 20px 0 #1e3a8a',
          }}
        >
          {theme.name}
        </Text>
        {theme.image && (
          <EdgeMedia src={theme.image} width={400} onLoad={() => setImageLoaded(true)} />
        )}
      </div>
      {startRound ? (
        <Button size="lg" onClick={startRound} disabled={users.length < 2}>
          Start Round
        </Button>
      ) : (
        <Alert color="blue" className="text-center self-center">
          <span className="text-xl">Waiting for the host to start the round</span>
        </Alert>
      )}
      <PlayerList />
    </Stack>
  );
}

function PlayerList() {
  const players = useChoppedStore((state) =>
    state.game!.users.filter((x) => x.status !== 'viewer')
  );
  return (
    <Text size="xs" className="text-center">
      <span className="font-bold">Players:</span>{' '}
      {players.map((x, i) => (
        <React.Fragment key={x.id}>
          <span
            className={`opacity-${x.connected ? '100' : '40'} ${
              x.status === 'eliminated' ? 'text-red-400' : ''
            }`}
          >
            {x.name}
          </span>
          {i === players.length - 1 ? '' : ', '}
        </React.Fragment>
      ))}
    </Text>
  );
}

function RoundSubmissions({ theme }: RoundProps) {
  const { submitImage } = useChoppedServer();
  const user = useChoppedStore((state) => state.game?.users.find((x) => x.id === state.userId));
  const spectating = user?.status === 'viewer' || user?.status === 'eliminated';
  const [submittedImage, setSubmittedImage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const submit = async () => {
    if (!submittedImage) return;
    setSubmitted(true);
    submitImage(submittedImage);
  };

  if (spectating)
    return (
      <Alert radius="sm" color="green" sx={{ zIndex: 10 }}>
        <Group spacing="xs" noWrap position="center">
          <Text size="md" weight={500}>
            Spectating
          </Text>
        </Group>
      </Alert>
    );

  return (
    <Stack align="center">
      <SubmissionCountdown w="100%" />
      {submittedImage && (
        <img src={submittedImage} className="w-80 rounded-md shadow-lg shadow-black" />
      )}
      {submittedImage && !submitted && (
        <Button size="md" onClick={submit} leftIcon={<IconSend />}>
          Submit Image
        </Button>
      )}
      {submitted && (
        <Alert radius="sm" color="green" sx={{ zIndex: 10 }}>
          <Group spacing="xs" noWrap position="center">
            <Text size="md" weight={500}>{`✅ We've got your submission`}</Text>
          </Group>
        </Alert>
      )}
      {!submitted && (
        <>
          <SubmissionDropzone
            theme={theme}
            onSelect={setSubmittedImage}
            minimized={!!submittedImage}
          />
          <SubmissionCreateButton theme={theme} minimized={!!submittedImage} />
        </>
      )}
    </Stack>
  );
}

function SubmissionCountdown(props: BoxProps) {
  const { start, end } = useChoppedStore((state) => {
    const round = state.game!.rounds[state.game!.round.toString()];
    return {
      start: round.submissionsOpenedAt!,
      end: round.submissionsOpenedAt! + round.duration * 1000,
    };
  });
  const duration = end - start;
  const [timeRemaining, setTimeRemaining] = useState(end - Date.now());
  const endingSoon = timeRemaining < 30 * 1000;

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeRemaining = end - Date.now();
      setTimeRemaining(newTimeRemaining > 0 ? newTimeRemaining : 0);
    }, 1000);

    return () => clearInterval(timer);
  }, [end]);

  return (
    <Box {...props} className="flex flex-col items-center relative">
      <Progress
        className="w-full"
        value={(timeRemaining / duration) * 100}
        animate
        color={endingSoon ? 'red' : 'blue'}
        h={24}
      />
      <Text
        size="lg"
        align="center"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 leading-none font-bold"
      >
        {timeRemaining <= 0 ? "Time's up!" : numberWithCommas(Math.floor(timeRemaining / 1000))}
      </Text>
    </Box>
  );
}

function SubmissionDropzone({
  theme,
  onSelect,
  minimized,
}: {
  theme: Theme;
  onSelect: (image: string) => void;
  minimized?: boolean;
}) {
  // TODO chopped.frontend - make minimized make the dropzone smaller and only show the theme name at text-2xl
  // TODO chopped.frontend - Make the dropzone clickable to open add upload image dialog

  const handleDrop = async (files: File[]) => {
    const blob = await resizeImage(files[0], { maxWidth: 512, maxHeight: 512 });
    const base64 = await getBase64(blob);
    onSelect(base64);
  };

  const handleDropCapture = async (e: DragEvent) => {
    const url = e.dataTransfer.getData('text/uri-list');
    const blob = await fetchBlob(url);
    if (!blob) return;
    const file = new File([blob], url.substring(url.lastIndexOf('/')), { type: blob.type });
    handleDrop([file]);
  };

  return (
    <Dropzone
      accept={IMAGE_MIME_TYPE}
      onDrop={handleDrop}
      onDropCapture={handleDropCapture}
      maxFiles={1}
    >
      <div
        className={`flex min-h-[200] w-full max-w-md flex-col flex-nowrap justify-center rounded-lg border-4 border-dashed border-gray-400 p-8 text-center text-2xl font-extrabold uppercase transition-colors duration-300 ease-in-out hover:border-gray-200 cursor-pointer`}
      >
        {!minimized && (
          <span className="-mb-1 leading-none tracking-widest opacity-40">Drop your</span>
        )}
        <span className="text-5xl tracking-tighter opacity-60">{theme.name}</span>
        {!minimized && <span className="tracking-widest opacity-40">Image here</span>}
      </div>
    </Dropzone>
  );
}

function SubmissionCreateButton({ theme, minimized }: { theme: Theme; minimized?: boolean }) {
  const createSubmission = async () => {
    console.log('Creating submission for', theme.name);
    generationPanel.open({
      type: 'modelVersions',
      ids: theme.resources?.map((air) => parseAIR(air).version) ?? [],
    });
  };

  return (
    <Button
      size={minimized ? 'sm' : 'lg'}
      compact
      onClick={createSubmission}
      className="self-center"
    >
      <Group spacing={4}>
        <IconBrush size={minimized ? 16 : 20} /> Create
      </Group>
    </Button>
  );
}

function RoundJudging({ theme }: RoundProps) {
  // the backend will automatically progress from here when it's ready
  const isHost = useIsHost();
  const pendingCount = useChoppedStore(
    (state) =>
      state.game!.rounds[state.game!.round.toString()].submissions.filter(
        (x) => x.judgeStatus !== 'complete'
      ).length
  );

  return (
    <Stack align="center">
      <Title>Judge Review</Title>
      <JudgePanelShowcase type="critiquing" />
      <Text size="xl">The judges are still reviewing {pendingCount} entries.</Text>
      <ChoppedRetryButton />
    </Stack>
  );
}

type JudgeThinkType = 'critiquing' | 'deciding';
function JudgePanelShowcase({
  type = 'critiquing',
  rotationTime = 1000,
}: {
  type: JudgeThinkType;
  rotationTime?: number;
}) {
  const judges = useChoppedStore((state) => {
    const { judgeIds } = state.game!;
    return state.global.judges.filter((j) => judgeIds.includes(j.id));
  });

  const [selectedJudge, setSelectedJudge] = useState<{ judge: Judge; score: number }>({
    judge: getRandom(judges),
    score: getRandomInt(1, 10),
  });
  useEffect(() => {
    const rotation = setTimeout(() => {
      let judge = selectedJudge.judge;
      if (judges.length > 1) {
        while (judge == selectedJudge.judge) {
          judge = getRandom(judges);
        }
      }
      setSelectedJudge({
        judge,
        score: getRandomInt(1, 10),
      });
    }, rotationTime);
    return () => clearTimeout(rotation);
  }, [selectedJudge]);

  return <JudgeDecision judge={selectedJudge.judge} score={selectedJudge.score} type={type} />;
}

function JudgeDecision({
  judge,
  score,
  type = 'critiquing',
}: {
  judge: Judge;
  score: number;
  type: JudgeThinkType;
}) {
  return (
    <div className="relative max-w-[400px] rounded-md overflow-hidden shadow-lg shadow-black">
      <EdgeMedia src={judge.avatar} width={400} />
      <ChoppedJudgeReaction
        score={score}
        size={120}
        radius={0}
        className="absolute bottom-0 right-0 rounded-tl-lg shadow-xl shadow-black"
        type={type}
      />
    </div>
  );
}

function RoundShowing({ theme }: RoundProps) {
  const isHost = useIsHost();
  const userId = useChoppedUserId();
  const server = useChoppedServer();
  const { submission } = useChoppedStore((state) => {
    const round = state.game!.rounds[state.game!.round.toString()];
    const showcaseId = Object.keys(round.showcaseIds)[0];
    const submission = round.submissions.find((x) => x.id === showcaseId)!;
    console.log({ showcaseId, submission });
    return {
      submission,
    };
  });

  const canProgress = isHost || submission?.userId === userId;
  const onContinue = canProgress
    ? async () => {
        console.log('Continuing to next round');
        // Tells the back-end to continue next showcase item or next stage of round
        server.continueGame();
      }
    : undefined;

  return (
    <div className="flex flex-col items-center gap-4 relative">
      <ChoppedUserSubmission submission={submission} />
      <ChoppedJudgeComment
        judgeId={submission.judgeId!}
        text={submission.judgeCritiqueText!}
        audio={submission.judgeCritiqueAudio!}
        onContinue={onContinue}
        indicator={
          <ChoppedJudgeReaction
            score={submission.judgeScore!}
            size={30}
            radius={0}
            className="absolute bottom-0 right-0 rounded-tl-lg shadow-xl shadow-black"
          />
        }
      />
    </div>
  );
}

function RoundDeciding({ theme }: RoundProps) {
  // the backend will automatically progress from here when it's ready
  const decision = useChoppedStore((state) => {
    const round = state.game!.rounds[state.game!.round.toString()];
    return {
      type: round.decisionType,
      needed: round.decisionsNeeded,
    };
  });

  return (
    <Stack align="center">
      <Title className="capitalize">{decision.type} Discussions</Title>
      <JudgePanelShowcase type="deciding" rotationTime={3000} />
      {decision.type === 'elimination' ? (
        <Text size="xl">The judges are determining who will be eliminated this round</Text>
      ) : (
        <Text size="xl">The judges are making a final decision</Text>
      )}
    </Stack>
  );
}

function RoundAwarding({ theme }: RoundProps) {
  const isHost = useIsHost();
  const server = useChoppedServer();
  const { decisionType, submissions, ...comment } = useChoppedStore((state) => {
    const round = state.game!.rounds[state.game!.round.toString()];
    return {
      decisionType: round.decisionType,
      submissions: round.submissions.filter((submission) => round.decisionUsers[submission.userId]),
      judgeId: round.judgeId!,
      text: round.judgeDecisionText!,
      audio: round.judgeDecisionAudio!,
    };
  });

  const onContinue = isHost
    ? async () => {
        console.log('Continuing to next round');
        server.continueGame();
      }
    : undefined;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center items-center -m-2">
        {submissions.map((submission) => (
          <div
            className={`relative ${
              submissions.length === 1 ? 'w-80' : 'w-1/2'
            } p-2 flex justify-center`}
            key={submission.id}
          >
            <ChoppedUserSubmission submission={submission} decisionType={decisionType} />
          </div>
        ))}
      </div>
      <ChoppedJudgeComment {...comment} onContinue={onContinue} />
    </div>
  );
}

const roundStates: Partial<Record<RoundStatus, React.FC<RoundProps>>> = {
  pending: RoundPending,
  submissions: RoundSubmissions,
  judging: RoundJudging,
  showing: RoundShowing,
  deciding: RoundDeciding,
  awarding: RoundAwarding,
};
