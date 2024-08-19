import { Injectable } from '@nestjs/common';
import { ProblemDto } from './dto/createProblem.dto';
import { SolutionDto } from './dto/solution.dto';
import problemsSchema from 'src/models/problems.schema';
import { newProblemNumber } from '../../utils/newProblemNumber.util';
import { config } from 'dotenv';
import userSchema from 'src/models/user.schema';
import { defaultIfEmpty } from 'rxjs';
import { RateDto } from './dto/rate.dto';
import rankPoint from 'src/enums/rankPoint.enum';
import { UserStreak, IUserStreak } from '../../models/streak.schema';
import questSchema from 'src/models/quest.schema';
import { SearchProblemDto } from './dto/searchProblem.dto';
config(); const env = process.env;

@Injectable()
export class ProblemService {
  private rankThresholds = [
    { rank: rankPoint.none, minScore: 0 },
    { rank: rankPoint.Bronze4, minScore: 1 },
    { rank: rankPoint.Bronze3, minScore: 71 },
    { rank: rankPoint.Bronze2, minScore: 141 },
    { rank: rankPoint.Bronze1, minScore: 281 },
    { rank: rankPoint.Silver3, minScore: 351 },
    { rank: rankPoint.Silver2, minScore: 431 },
    { rank: rankPoint.Silver1, minScore: 511 },
    { rank: rankPoint.Gold3, minScore: 591 },
    { rank: rankPoint.Gold2, minScore: 681 },
    { rank: rankPoint.Gold1, minScore: 771 },
    { rank: rankPoint.Platinum3, minScore: 861 },
    { rank: rankPoint.Platinum2, minScore: 961 },
    { rank: rankPoint.Platinum1, minScore: 1071 },
    { rank: rankPoint.Diamond3, minScore: 1181 },
    { rank: rankPoint.Diamond2, minScore: 1301 },
    { rank: rankPoint.Diamond1, minScore: 1451 },
    { rank: rankPoint.Ace, minScore: 1601 },
    { rank: rankPoint.Master, minScore: 2201 }
  ];

  async createProblem(createProblemDto: ProblemDto, userid: string) {
    const problemNumber = await newProblemNumber();
    const newPb = await new problemsSchema({
      creator: userid,
      problemNumber: problemNumber,
      subject: createProblemDto.subject,
      content: createProblemDto.content,
      testcases: createProblemDto.testcases,
      rankPoint: createProblemDto.rank
    });
    if (createProblemDto.answer) newPb.answerCode = createProblemDto.answer;
    await newPb.save();
    return {
      result: true
    }
  }

  async getProblem(no: Number) {
    let problem = await problemsSchema.findOne({ problemNumber: no });
    if (!problem) problem = null;
    return problem;
  }

  async searchProblem(body: SearchProblemDto) {
    switch (body.mode) {
      case 'recent':
        return await this.getRecentProblems(50);
      case 'query':
        return await problemsSchema.find({
          subject: { $regex: body.query ?? null, $options: 'i' } // 대소문자를 구분하지 않는 부분 검색
        }).limit(50);
      default:
        return await problemsSchema.find({
          rankPoint: { $regex: body.mode, $options: 'i' }
        }).limit(50);
    }
  }

  async editProblem(probNum: number, jureuk: ProblemDto, userid: string) {
    let problem = await problemsSchema.findOne({ problemNumber: probNum });
    if (problem.creator !== userid) return {
      result: false
    }; else {
      await problemsSchema.findOneAndUpdate({ problemNumber: probNum }, {
        rankPoint: jureuk.rank,
        answerCode: jureuk.answer ?? "",
        subject: jureuk.subject,
        content: jureuk.content,
        testcases: jureuk.testcases
      });
      return {
        result: true
      };
    }
  }

  async deleteProblem(id: number, userid: string) {
    const problem = await problemsSchema.findOne({ problemNumber: id });
    if (problem.creator !== userid) {
      return {
        result: false
      }
    } else {
      await problem.deleteOne({ problemNumber: id })
      return {
        result: true
      }
    }
  }

  async solveProblem(problemId: number, solutionDto: SolutionDto, userid: string) {
    const fetchReq: any = await fetch(`${env.JUDGE_DOMAIN}`, {
      method: "POST",
      body: JSON.stringify({
        problemNumber: problemId,
        userid: userid,
        language: solutionDto.language,
        usercode: solutionDto.code
      })
    });
    const user = await userSchema.findOne({ nxpid: userid });
    const probNum = problemId.toString();
    const problem = await problemsSchema.findOne({ problemNumber: problemId });
    problem.submit_count = problem.submit_count + 1;
    switch (fetchReq.json().result) {
      case "정답입니다":
        if (probNum in user.wrong_problems) user.wrong_problems.splice(user.wrong_problems.indexOf(probNum), 1);
        if (!(probNum in user.solved_problems)) user.solved_problems.unshift(probNum);
        await user.save();
        await this.updateStreak(userid);
        await this.setRank(rankPoint[problem.rankPoint], userid);
        problem.solved_count = problem.solved_count + 1;
        break;
      case "틀렸습니다":
        if (!(probNum in user.wrong_problems)) user.wrong_problems.unshift(probNum);
        await user.save();
        break;
      default:
        break;
    };
    await problem.save();
    return {
      result: true ? fetchReq.json().result == "정답입니다" : false,
      message: fetchReq.json().result
    };
  }

  async rateProblem(problemId: number, rateDto: RateDto, userid: string) {
    const problem = await problemsSchema.findOne({ problemNumber: problemId });
    let filteredRates: any = problem.userRate.filter(item => item.userid !== userid);
    filteredRates.unshift({ userid: userid, votedRank: rateDto.votedRank, comment: rateDto.comment });
    problem.userRate = filteredRates;
    problem.rankPoint = rankPoint[Math.round((rankPoint[problem.rankPoint] + rankPoint[rateDto.votedRank]) / 2)];
    await problem.save();
    return {
      result: true
    }
  }

  async getCurrentStreak(userId: string) {
    const streak = await UserStreak.findOne({ userId: userId });
    return streak?.currentStreak ?? 0;
  }

  async updateStreak(userId: string): Promise<IUserStreak | null> {
    const streak = await UserStreak.findOne({ userId: userId });

    const today = new Date();
    const todayDate = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];

    if (!streak) {
      const newStreak = new UserStreak({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: new Date(todayDate),
      });
      return newStreak.save();
    }

    if (streak.lastActiveDate && streak.lastActiveDate.toISOString().split('T')[0] === todayDate) {
      return streak;
    }

    if (streak.lastActiveDate && streak.lastActiveDate.toISOString().split('T')[0] === yesterdayDate) {
      streak.currentStreak += 1;
    } else {
      streak.currentStreak = 1;
    }

    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }

    streak.lastActiveDate = new Date(todayDate);
    return streak.save();
  }

  async getRecommendedProblems(userId: string) {
    let dailyQuest = await questSchema.findOne({ userid: userId });
    return dailyQuest;
  }

  async getRecentProblems(count: number) {
    const problems = await problemsSchema.find().sort({ createdAt: -1 }).limit(50);
    return problems;
  }

  async setRank(score: number, userid: string) {
    for (const threshold of this.rankThresholds) {
      if (score >= threshold.minScore) {
        const user = await userSchema.findOne({ nxpid: userid });
        user.rankPoint = score;
        user.rank = rankPoint[threshold.rank];
        await user.save();
        return true;
      }
    }
    return false; // default case
  }
}
