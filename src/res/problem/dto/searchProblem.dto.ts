import { ApiProperty } from "@nestjs/swagger";

export class SearchProblemDto {
    // recent, rank-up(어려운 순), rank-down(쉬운 순), 특정 티어(ex Diamond1), query
    @ApiProperty({
        description: "검색 모드입니다.",
        example: "rank-down"
    })
    mode!: string;

    @ApiProperty({
        description: "검색 쿼리입니다",
        example: "별 따러 가자"
    })
    query?: string;
};