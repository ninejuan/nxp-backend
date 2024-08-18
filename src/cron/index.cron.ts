import cron from 'node-cron';
import { checkStreaks } from './streak.cron';

// 매일 자정에 실행
cron.schedule('0 0 * * *', () => {
    checkStreaks();
});
