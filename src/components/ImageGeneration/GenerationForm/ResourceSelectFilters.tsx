import {
  ActionIcon,
  Button,
  Chip,
  ChipProps,
  createStyles,
  Divider,
  Drawer,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { IconChevronDown, IconChevronUp, IconFilter } from '@tabler/icons-react';
import { uniq } from 'lodash-es';
import React, { useState } from 'react';
import { ResourceSelectOptions } from '~/components/ImageGeneration/GenerationForm/resource-select.types';
import { SelectMenuV2 } from '~/components/SelectMenu/SelectMenu';
import useIsClient from '~/hooks/useIsClient';
import { useIsMobile } from '~/hooks/useIsMobile';
import { useFeatureFlags } from '~/providers/FeatureFlagsProvider';
import { activeBaseModels, BaseModel } from '~/server/common/constants';
import { ResourceSort } from '~/server/common/enums'; // Add this import
import { ModelType } from '~/shared/utils/prisma/enums';
import { sortByModelTypes } from '~/utils/array-helpers';
import { containerQuery } from '~/utils/mantine-css-helpers';
import { getDisplayName } from '~/utils/string-helpers';

const useStyles = createStyles((theme) => ({
  label: {
    fontSize: 12,
    fontWeight: 600,

    '&[data-checked]': {
      '&, &:hover': {
        color: theme.colorScheme === 'dark' ? theme.white : theme.black,
        border: `1px solid ${theme.colors[theme.primaryColor][theme.fn.primaryShade()]}`,
      },

      '&[data-variant="filled"]': {
        // color: theme.colorScheme === 'dark' ? theme.white : theme.black,
        backgroundColor: 'transparent',
      },
    },
  },
  opened: {
    transform: 'rotate(180deg)',
    transition: 'transform 200ms ease',
  },

  actionButton: {
    [containerQuery.smallerThan('sm')]: {
      width: '100%',
    },
  },

  indicatorRoot: { lineHeight: 1 },
  indicatorIndicator: { lineHeight: 1.6 },
}));

const baseModelLimit = 4;

export function ResourceSelectFiltersDropdown({
  options,
  states,
}: {
  options: ResourceSelectOptions;
  states: {
    resourceTypes: ModelType[];
    setResourceTypes: React.Dispatch<React.SetStateAction<ModelType[]>>;
    baseModels: BaseModel[];
    setBaseModels: React.Dispatch<React.SetStateAction<BaseModel[]>>;
  };
}) {
  const { classes, theme, cx } = useStyles();
  const mobile = useIsMobile();
  const isClient = useIsClient();

  const [opened, setOpened] = useState(false);
  const [truncateBaseModels, setTruncateBaseModels] = useLocalStorage({
    key: 'image-filter-truncate-base-models',
    defaultValue: false,
  });

  const resourceTypesList = sortByModelTypes(
    (options.resources ? options.resources.map((r) => r.type) : Object.values(ModelType)).map(
      (rt) => ({ modelType: rt as ModelType })
    )
  );
  const baseModelsList = options.resources
    ? uniq(options.resources.flatMap((r) => (r.baseModels ?? []) as BaseModel[]))
    : activeBaseModels;

  const displayedBaseModels = truncateBaseModels
    ? baseModelsList.filter((bm, idx) => idx < baseModelLimit || states.baseModels.includes(bm))
    : baseModelsList;

  const filterLength =
    (states.resourceTypes.length > 0 ? 1 : 0) + (states.baseModels.length > 0 ? 1 : 0);

  const clearFilters = () => {
    states.setResourceTypes([]);
    states.setBaseModels([]);
  };

  const chipProps: Partial<ChipProps> = {
    size: 'sm',
    radius: 'xl',
    variant: 'filled',
    classNames: classes,
    tt: 'capitalize',
  };

  const target = (
    <Indicator
      offset={4}
      label={isClient && filterLength ? filterLength : undefined}
      size={16}
      zIndex={10}
      showZero={false}
      dot={false}
      classNames={{ root: classes.indicatorRoot, indicator: classes.indicatorIndicator }}
      inline
    >
      <Button
        // className={classes.actionButton}
        color="gray"
        radius="xl"
        variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
        rightIcon={<IconChevronDown className={cx({ [classes.opened]: opened })} size={16} />}
        onClick={() => setOpened((o) => !o)}
        data-expanded={opened}
        compact
      >
        <Group spacing={4} noWrap>
          <IconFilter size={16} />
          Filters
        </Group>
      </Button>
    </Indicator>
  );

  const dropdown = (
    <Stack spacing="lg" p="md">
      <Stack spacing="md">
        <Divider label="Resource types" labelProps={{ weight: 'bold', size: 'sm' }} />
        <Chip.Group
          spacing={8}
          value={states.resourceTypes}
          onChange={(rts: ModelType[]) => states.setResourceTypes(rts)}
          multiple
          my={4}
        >
          {resourceTypesList.map((rt, index) => (
            <Chip key={index} value={rt.modelType} {...chipProps}>
              {getDisplayName(rt.modelType)}
            </Chip>
          ))}
        </Chip.Group>
        <Divider label="Base model" labelProps={{ weight: 'bold', size: 'sm' }} />
        <Chip.Group
          spacing={8}
          value={states.baseModels}
          onChange={(bms: BaseModel[]) => states.setBaseModels(bms)}
          multiple
          my={4}
        >
          {displayedBaseModels.map((baseModel, index) => (
            <Chip key={index} value={baseModel} {...chipProps}>
              {baseModel}
            </Chip>
          ))}
          {baseModelsList.length > baseModelLimit && (
            <ActionIcon
              variant="transparent"
              size="sm"
              onClick={() => setTruncateBaseModels((prev) => !prev)}
            >
              {truncateBaseModels ? (
                <IconChevronDown strokeWidth={3} />
              ) : (
                <IconChevronUp strokeWidth={3} />
              )}
            </ActionIcon>
          )}
        </Chip.Group>
      </Stack>

      {filterLength > 0 && (
        <Button
          color="gray"
          variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
          onClick={clearFilters}
          fullWidth
        >
          Clear all filters
        </Button>
      )}
    </Stack>
  );

  if (mobile)
    return (
      <>
        {target}
        <Drawer
          opened={opened}
          onClose={() => setOpened(false)}
          size="90%"
          position="bottom"
          styles={{
            root: {
              zIndex: 400,
            },
            drawer: {
              height: 'auto',
              maxHeight: 'calc(100dvh - var(--header-height))',
              overflowY: 'auto',
            },
            body: { padding: 0, overflowY: 'auto' },
            header: { padding: '4px 8px' },
            closeButton: { height: 32, width: 32, '& > svg': { width: 24, height: 24 } },
          }}
        >
          {dropdown}
        </Drawer>
      </>
    );

  return (
    <Popover
      zIndex={200}
      position="bottom-end"
      shadow="md"
      radius={12}
      onClose={() => setOpened(false)}
      middlewares={{ flip: true, shift: true }}
      // withinPortal
    >
      <Popover.Target>{target}</Popover.Target>
      <Popover.Dropdown maw={468} p={0} w="100%">
        <ScrollArea.Autosize type="hover" maxHeight={'calc(90vh - var(--header-height) - 56px)'}>
          {dropdown}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}

export function ResourceSelectSort({
  value,
  onChange,
}: {
  value: ResourceSort;
  onChange: (value: ResourceSort) => void;
}) {
  const { canViewNsfw } = useFeatureFlags();

  return (
    <SelectMenuV2
      label={value}
      value={value}
      onClick={onChange}
      options={Object.values(ResourceSort)
        .map((x) => ({ label: x, value: x }))
        .filter((x) => {
          return !(!canViewNsfw && x.value === 'Newest');
        })}
      drawerStyles={{
        root: {
          zIndex: 400,
        },
      }}
    />
  );
}
