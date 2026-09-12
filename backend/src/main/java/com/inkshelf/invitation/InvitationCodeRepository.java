package com.inkshelf.invitation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import javax.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

/** 邀请码查询；注册消费时使用行级写锁保证同一码只能成功一次。 */
public interface InvitationCodeRepository extends JpaRepository<InvitationCode, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select code from InvitationCode code where code.codeHash = :hash")
    Optional<InvitationCode> findByHashForUpdate(@Param("hash") String hash);

    @EntityGraph(attributePaths = {"createdBy", "usedBy", "disabledBy"})
    List<InvitationCode> findAllByOrderByCreatedAtDesc();
}
