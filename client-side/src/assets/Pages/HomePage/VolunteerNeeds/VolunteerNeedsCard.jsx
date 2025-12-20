import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import CardHeader from '@mui/material/CardHeader';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { Link } from 'react-router-dom';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

export default function VolunteerNeedsCard({ volunteer }) {
  const { _id, thumbnail, post_title, category, deadline, description, likes = 0, comments = 0 } = volunteer;
  const [imgError, setImgError] = React.useState(false);
  const { t } = useTranslation();

  return (
    <Card sx={{ maxWidth: 420, m: 2, borderRadius: 3, boxShadow: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        avatar={<Avatar sx={{ bgcolor: 'primary.main' }}>{(category || 'E').slice(0, 1)}</Avatar>}
        title={
          <Tooltip title={post_title} placement="top">
            <Typography
              variant="h6"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                lineHeight: 1.3,
                minHeight: '2.6em' // reserve 2 lines height so short titles still align
              }}
            >
              {post_title}
            </Typography>
          </Tooltip>
        }
        subheader={<Typography variant="body2" color="text.secondary">{t('common.starts')}: {deadline || '—'}</Typography>}
        sx={{ '& .MuiCardHeader-content': { minHeight: 64 } }}
      />

      <CardActionArea sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        {imgError || !thumbnail ? (
          <Box sx={{ height: 300, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">{t('common.noImage')}</Typography>
          </Box>
        ) : (
          <CardMedia
            component="img"
            height="200"
            image={thumbnail}
            alt={post_title}
            onError={() => setImgError(true)}
            sx={{ height: 300, width: '100%', objectFit: 'cover', objectPosition: 'top' }}
          />
        )}
        <CardContent sx={{ flexGrow: 1, minHeight: 88 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Chip size="small" label={category || 'Event'} color="primary" variant="outlined" />
          </Stack>
          <Tooltip title={description} placement="bottom-start">
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {description}
            </Typography>
          </Tooltip>
        </CardContent>
      </CardActionArea>

      <Divider />
      <CardActions sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
            <FavoriteBorderIcon fontSize="small" />
            <Typography variant="body2">{likes}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
            <ChatBubbleOutlineIcon fontSize="small" />
            <Typography variant="body2">{comments}</Typography>
          </Stack>
        </Stack>
        <Link to={`/events/${_id}`} style={{ textDecoration: 'none' }}>
          <Button size="small" variant="contained" color="success">
            {t('common.viewDetails')}
          </Button>
        </Link>
      </CardActions>
    </Card>
  );
}
